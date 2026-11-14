import { test, expect } from './fixtures';
import {
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
  cleanupCreated,
  createCustomer,
  createOrder,
  createProduct,
  createQuote,
  e2eName,
} from './helpers/api';
import { gotoApp } from './helpers/nav';

/**
 * Regresion del flujo presupuesto -> pedido -> cola -> stock
 * (BUSINESS-RULES §9, §11, §12.4; errores A-5, A-6, E81, E84, E86, M-5).
 * Los pedidos no se borran (se cancelan y quedan en el historial), asi que el cliente E2E
 * y sus tareas canceladas pueden quedar en la base: son datos E2E- inofensivos.
 */

interface PrintJob {
  id: string;
  orderId?: string;
  productName: string;
  taskType: 'PREPARE_ORDER' | 'PRODUCTION' | 'SERVICE' | 'INTERNAL';
  status: string;
  quantity: number;
  prepareReadiness?: { canStart: boolean; waitingReason?: string };
}
interface OrderItem {
  quantity: number;
  reservedQuantity?: number;
  productionRequiredQuantity?: number;
  producedQuantity?: number;
  deliveredQuantity?: number;
}
interface Order {
  id: string;
  status: string;
  dueDate: string;
  items: OrderItem[];
}
interface Product {
  id: string;
  name: string;
  stock: number;
  stockOverview: { physical: number; reserved: number; available: number };
}
interface Quote {
  id: string;
  status: string;
  orderId?: string;
  items: Array<{ unitCost?: number; unitPrice: number }>;
}

const RESPONSIBLE = 'e2e-responsable';
const DUE = () => new Date(Date.now() + 20 * 86_400_000).toISOString();
const DUE_LATER = () => new Date(Date.now() + 27 * 86_400_000).toISOString();

let customerId = '';
let categoryId = '';
const jobsOf = (orderId: string) => apiGet<PrintJob[]>(`print-jobs?orderId=${orderId}`);
const getOrder = (id: string) => apiGet<Order>(`orders/${id}`);
const getProduct = (id: string) => apiGet<Product>(`products/${id}`);

async function newProduct(label: string, stock: number) {
  return createProduct({
    name: e2eName(label),
    type: 'fdm',
    grams: 50,
    printTimeHours: 2,
    workTimeHours: 0.5,
    filamentType: 'pla',
    price: 5000,
    cost: 2000,
    published: true,
    stock,
    categoryIds: [categoryId],
  });
}

function line(product: { id: string; name: string }, quantity: number) {
  return {
    serviceType: 'impresion_3d',
    productId: product.id,
    productName: product.name,
    quantity,
    unitPrice: 5000,
    unitCost: 2000,
  };
}

async function newOrder(product: { id: string; name: string }, quantity: number) {
  const order = await createOrder({
    customerId,
    items: [line(product, quantity)],
    dueDate: DUE(),
    responsibleUserId: RESPONSIBLE,
  });
  const jobs = await jobsOf(order.id);
  return {
    order,
    jobs,
    prepare: jobs.find((j) => j.taskType === 'PREPARE_ORDER')!,
    make: jobs.find((j) => j.taskType === 'PRODUCTION'),
  };
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  customerId = (await createCustomer()).id;
  const cats = await apiGet<Array<{ id: string; productTypes: string[] }>>('categories');
  categoryId = cats.find((c) => c.productTypes.includes('fdm'))!.id;
});

test.afterAll(async () => {
  // Los pedidos quedan cancelados (retencion §25.8); productos y presupuestos se borran.
  await cleanupCreated();
});

test('A-5: un pedido con producto sin stock genera la tarea "Hacer N"', async () => {
  const product = await newProduct('sin stock', 0);
  const { make, prepare } = await newOrder(product, 3);
  expect(make, 'falta la tarea Hacer').toBeTruthy();
  expect(make!.productName).toBe(`Hacer 3 ${product.name}`);
  expect(make!.quantity).toBe(3);
  expect(prepare).toBeTruthy();
});

test('A-5: aceptar un presupuesto con una linea nueva genera "Hacer"', async () => {
  const product = await newProduct('presupuesto', 0);
  const quote = await createQuote({
    customerId,
    items: [line(product, 2)],
    status: 'enviado',
  });
  const accepted = await apiPatch<Quote>(`quotes/${quote.id}/status`, { status: 'aceptado' });
  expect(accepted.status).toBe('aceptado');
  expect(accepted.orderId).toBeTruthy();
  const jobs = await jobsOf(accepted.orderId!);
  const make = jobs.find((j) => j.taskType === 'PRODUCTION');
  expect(make?.productName).toBe(`Hacer 2 ${product.name}`);
});

test('stock parcial: "Hacer" solo por el faltante y no se duplica al iniciar la preparacion', async () => {
  const product = await newProduct('parcial', 2);
  const { order, make, prepare } = await newOrder(product, 5);
  expect(make!.productName).toBe(`Hacer 3 ${product.name}`);
  expect(prepare.prepareReadiness?.canStart).toBe(true);

  await apiPatch(`print-jobs/${prepare.id}/status`, { status: 'en_proceso' });
  const jobs = await jobsOf(order.id);
  const makes = jobs.filter((j) => j.taskType === 'PRODUCTION' && j.status !== 'cancelado');
  expect(makes).toHaveLength(1);
  expect(makes[0].productName).toBe(`Hacer 3 ${product.name}`);
  expect(jobs.find((j) => j.id === prepare.id)!.status).toBe('en_proceso');
  const item = (await getOrder(order.id)).items[0];
  expect(item.reservedQuantity).toBe(2);
  expect(item.productionRequiredQuantity).toBe(3);
});

test('E81/E84 API: Preparar pedido sin stock espera produccion; con stock puede iniciar', async () => {
  const empty = await newProduct('prep sin stock', 0);
  const a = await newOrder(empty, 2);
  expect(a.prepare.prepareReadiness?.canStart).toBe(false);
  expect(a.prepare.prepareReadiness?.waitingReason).toContain('Esperando producción');

  const stocked = await newProduct('prep con stock', 5);
  const b = await newOrder(stocked, 2);
  expect(b.make).toBeUndefined();
  expect(b.prepare.prepareReadiness?.canStart).toBe(true);
});

test('E81/E84 UI: la tarjeta dice "Lista para iniciar" y "Iniciar preparación" la pasa a En progreso', async ({
  page,
}) => {
  const product = await newProduct('ui prep', 5);
  const { order, prepare } = await newOrder(product, 2);
  await gotoApp(page, '/cola');
  await page.getByPlaceholder('Buscar por pedido o tarea').fill(order.id);
  const card = page.locator('article.job-card--board', { hasText: `#${order.id}` });
  await expect(card).toBeVisible();
  await expect(card.getByText('Lista para iniciar')).toBeVisible();
  await card.getByRole('button', { name: 'Iniciar preparación' }).click();
  await expect
    .poll(async () => (await jobsOf(order.id)).find((j) => j.id === prepare.id)!.status)
    .toBe('en_proceso');
});

test('A-6: entregar un pedido con producto en stock descuenta el stock una sola vez', async () => {
  const product = await newProduct('entrega', 4);
  const { order, prepare } = await newOrder(product, 3);
  const before = (await getProduct(product.id)).stockOverview.physical;
  expect(before).toBe(4);
  await apiPatch(`print-jobs/${prepare.id}/status`, { status: 'en_proceso' });
  await apiPost(`orders/${order.id}/deliver-all`, {}, false);
  const after = await getProduct(product.id);
  expect(after.stockOverview.physical).toBe(1);
  expect(after.stock).toBe(1);
  expect((await getOrder(order.id)).status).toBe('entregado');
  // Reintento: no vuelve a descontar.
  await new Promise((r) => setTimeout(r, 300));
  expect((await getProduct(product.id)).stockOverview.physical).toBe(1);
});

test('editar la fecha de un pedido con produccion hecha conserva lo producido', async () => {
  const product = await newProduct('fecha', 2);
  const { order, prepare, make } = await newOrder(product, 5);
  await apiPatch(`print-jobs/${prepare.id}/status`, { status: 'en_proceso' });
  for (const status of ['en_proceso', 'en_revision', 'terminado']) {
    await apiPatch(`print-jobs/${make!.id}/status`, { status });
  }
  expect((await getOrder(order.id)).items[0].producedQuantity).toBe(3);
  const later = DUE_LATER();
  await apiPatch(`orders/${order.id}`, { dueDate: later });
  const after = await getOrder(order.id);
  expect(after.dueDate).toBe(later);
  expect(after.items[0].producedQuantity).toBe(3);
});

test('M-5: un presupuesto en Borrador guardado con "Guardar" sigue en Borrador', async ({ page }) => {
  const product = await newProduct('borrador', 0);
  const quote = await createQuote({ customerId, items: [line(product, 1)], status: 'borrador' });
  expect((await apiGet<Quote>(`quotes/${quote.id}`)).status).toBe('borrador');
  await gotoApp(page, `/presupuestos/${quote.id}`);
  await page.getByRole('button', { name: /^Editar/ }).first().click();
  const footer = page.locator('.quote-form__footer');
  await expect(footer).toBeVisible();
  await footer.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(footer).toBeHidden();
  expect((await apiGet<Quote>(`quotes/${quote.id}`)).status).toBe('borrador');
});

test('el costo unitario de una linea de servicio se conserva al guardar y releer', async () => {
  const quote = await createQuote({
    customerId,
    status: 'borrador',
    items: [
      {
        serviceType: 'modelado',
        productName: e2eName('servicio'),
        quantity: 2,
        unitPrice: 9000,
        unitCost: 3456,
      },
    ],
  });
  expect((await apiGet<Quote>(`quotes/${quote.id}`)).items[0].unitCost).toBe(3456);
  const saved = await apiPatch<Quote>(`quotes/${quote.id}`, {
    description: 'E2E guardado',
    items: [
      {
        serviceType: 'modelado',
        productName: e2eName('servicio'),
        quantity: 2,
        unitPrice: 9000,
        unitCost: 3456,
      },
    ],
  });
  expect(saved.items[0].unitCost).toBe(3456);
  expect((await apiGet<Quote>(`quotes/${quote.id}`)).items[0].unitCost).toBe(3456);
});

test.describe('E86 dialogo de tarea larga', () => {
  test.use({ viewport: { width: 1024, height: 768 } });

  test('"Cancelar" queda visible dentro del viewport', async ({ page }) => {
    const longName = e2eName(`tarea con un nombre muy largo ${'x'.repeat(100)}`);
    const task = await apiPost<{ id: string }>(
      'print-jobs',
      { productName: longName, type: 'impresion_3d', estimatedHours: 3 },
      false,
    );
    try {
      await gotoApp(page, '/cola');
      await page.getByPlaceholder('Buscar por pedido o tarea').fill(longName);
      await page.locator('article.job-card--board').first().click();
      const dialog = page.locator('app-form-dialog-shell');
      await expect(dialog).toBeVisible();
      const cancel = dialog.getByRole('button', { name: 'Cancelar' });
      await expect(cancel).toBeVisible();
      await expect(cancel).toBeInViewport({ ratio: 1 });
    } finally {
      await apiPatch(`print-jobs/${task.id}/status`, { status: 'cancelado' }).catch(() => undefined);
      await apiDelete(`print-jobs/${task.id}`).catch(() => undefined);
    }
  });
});
