import { test, expect } from './fixtures';
import {
  api,
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
import { gotoApp, openNewOrder } from './helpers/nav';

interface Payment {
  id: string;
  amount: number;
  voidedAt?: string;
  voidReason?: string;
}
interface OrderDto {
  id: string;
  total: number;
  status: string;
  payments?: Payment[];
  priceHistory?: Array<{ trigger: string }>;
  responsibleUserId?: string;
}

let customerId: string;
let responsibleUserId: string;
const extraOrderIds: string[] = [];
let extraQuoteIds: string[] = [];

const futureDate = () => new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10);

/** Pedido de una linea de diseno (sin catalogo) por API. */
function newOrder(unitPrice = 1000) {
  return createOrder({
    customerId,
    responsibleUserId,
    dueDate: futureDate(),
    items: [
      { serviceType: 'diseno_grafico', productName: e2eName('diseno'), quantity: 1, unitPrice },
    ],
  });
}

const getOrder = (id: string) => apiGet<OrderDto>(`orders/${id}`);

async function post(path: string, data: unknown) {
  return (await api()).post(path, { data });
}

test.describe('Pedidos: regresion de reglas corregidas', () => {
  test.beforeAll(async () => {
    customerId = (await createCustomer()).id;
    const responsibles = await apiGet<Array<{ firebaseUid: string }>>('user-access/order-responsibles');
    responsibleUserId = responsibles[0].firebaseUid;
  });

  test.afterAll(async () => {
    // Pedidos creados al aceptar presupuestos (no pasan por apiPost) y luego los presupuestos.
    for (const id of extraOrderIds) await apiDelete(`orders/${id}`);
    for (const id of extraQuoteIds) await apiDelete(`quotes/${id}`);
    await cleanupCreated();
  });

  test('A-1: pagos con monto negativo o cero dan 400 (API)', async () => {
    const order = await newOrder();
    for (const amount of [-500, 0]) {
      const res = await post(`orders/${order.id}/payments`, { amount });
      expect(res.status(), `monto ${amount}`).toBe(400);
    }
    expect((await getOrder(order.id)).payments ?? []).toHaveLength(0);
  });

  test('A-1: en la UI el monto -500 deshabilita "Registrar pago" y avisa', async ({ page }) => {
    const order = await newOrder();
    await gotoApp(page, `/pedidos/${order.id}`);
    await page.getByLabel('Monto del pago').fill('-500');
    await expect(page.getByText('El monto debe ser mayor a 0')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Registrar pago' })).toBeDisabled();
  });

  test('A-2: bajar el total por debajo de lo cobrado da 400 "Ya se cobraron"', async () => {
    const order = await newOrder(1000);
    const pay = await post(`orders/${order.id}/payments`, { amount: 800 });
    expect(pay.ok()).toBeTruthy();
    const res = await (await api()).patch(`orders/${order.id}`, { data: { discountPercent: 90 } });
    expect(res.status(), await res.text()).toBe(400);
    expect(await res.text()).toContain('Ya se cobraron');
    expect((await getOrder(order.id)).total).toBe(1000);
  });

  test('M-6: cambiar el descuento deja entrada en el historial de precios', async ({ page }) => {
    const order = await newOrder(1000);
    await apiPatch(`orders/${order.id}`, { discountPercent: 10 });
    const after = await getOrder(order.id);
    expect(after.priceHistory?.some((e) => e.trigger === 'discount_change')).toBeTruthy();

    await gotoApp(page, `/pedidos/${order.id}`);
    await expect(page.getByRole('heading', { name: 'Historial de precios' })).toBeVisible();
    await expect(page.getByText('Sin cambios de precio registrados')).toHaveCount(0);
  });

  test('U-16: anular un pago exige motivo; con motivo el saldo vuelve', async () => {
    const order = await newOrder(1000);
    const paid = await (await post(`orders/${order.id}/payments`, { amount: 400 })).json();
    const paymentId = paid.payments[0].id as string;

    const noReason = await post(`orders/${order.id}/payments/${paymentId}/void`, { reason: '' });
    expect(noReason.status()).toBe(400);
    const blank = await post(`orders/${order.id}/payments/${paymentId}/void`, { reason: '   ' });
    expect(blank.status()).toBe(400);

    const ok = await post(`orders/${order.id}/payments/${paymentId}/void`, { reason: 'E2E error de carga' });
    expect(ok.status()).toBeLessThan(300);
    const payment = (await getOrder(order.id)).payments![0];
    expect(payment.voidedAt).toBeTruthy();
    expect(payment.voidReason).toBe('E2E error de carga');

    // El saldo vuelve: se puede cobrar el total completo.
    const full = await post(`orders/${order.id}/payments`, { amount: 1000 });
    expect(full.ok()).toBeTruthy();
  });

  test('U-16: la UI muestra el pago como Anulado', async ({ page }) => {
    const order = await newOrder(1000);
    await post(`orders/${order.id}/payments`, { amount: 300 });
    await gotoApp(page, `/pedidos/${order.id}`);
    await page.getByRole('button', { name: 'Anular pago' }).click();
    const confirm = page.getByRole('button', { name: 'Confirmar anulación' });
    await expect(confirm).toBeDisabled();
    await page.getByLabel('Motivo de la anulación').fill('E2E motivo UI');
    await confirm.click();
    await expect(page.getByText('Anulado', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('E2E motivo UI')).toBeVisible();
  });

  test('E82: Nuevo pedido arranca con la seña vacia, "Usar 50%" y sin pagos al crear', async ({ page }) => {
    const product = await createProduct({
      type: 'fdm',
      price: 5000,
      cost: 2000,
      grams: 20,
      printTimeHours: 1,
      workTimeHours: 0,
      filamentType: 'pla',
      categoryIds: ['cat-1'],
      size: '',
      published: true,
    });
    await openNewOrder(page);

    // Cliente, responsable y producto (selects nativos).
    // Con nombres repetidos el selector agrega «(#abcd)»: se elige por nombre y, si hay varios, por ese sufijo.
    const customerName = (await apiGet<Array<{ id: string; name: string }>>('customers')).find((c) => c.id === customerId)!.name;
    const customerSelect = page.locator('select').filter({ has: page.locator('option', { hasText: 'Seleccionar cliente' }) });
    let customerOption = customerSelect.locator('option', { hasText: customerName });
    if ((await customerOption.count()) > 1) {
      customerOption = customerOption.filter({ hasText: `#${customerId.slice(-4)}` });
    }
    await customerSelect.selectOption((await customerOption.first().getAttribute('value'))!);
    await page.locator('select').filter({ has: page.locator('option', { hasText: 'Seleccionar responsable' }) })
      .selectOption({ index: 1 });
    await page.locator('select').filter({ has: page.locator('option', { hasText: product.name }) })
      .selectOption({ label: product.name });

    const deposit = page.locator('input[name="depositAmount"]');
    await expect(deposit).toHaveValue('');
    await expect(deposit).toHaveAttribute('placeholder', 'Sin seña');
    await expect(page.getByRole('button', { name: /Usar 50\s?%/ })).toBeVisible();

    const before = await apiGet<Array<{ id: string }>>('orders');
    await page.getByRole('button', { name: 'Crear pedido' }).click();
    await expect.poll(async () => (await apiGet<Array<{ id: string }>>('orders')).length).toBe(before.length + 1);
    const created = (await apiGet<Array<{ id: string; customerId: string; payments?: Payment[] }>>('orders'))
      .find((o) => o.customerId === customerId && !before.some((b) => b.id === o.id));
    expect(created).toBeTruthy();
    extraOrderIds.push(created!.id);
    expect(created!.payments ?? []).toHaveLength(0);
  });

  test('E85: el detalle muestra Responsable', async ({ page }) => {
    const order = await newOrder();
    await gotoApp(page, `/pedidos/${order.id}`);
    await expect(page.locator('dt', { hasText: 'Responsable' })).toBeVisible();
  });

  test('E50: pedido desde presupuesto aceptado muestra "Desde presupuesto quo-"', async ({ page }) => {
    const quote = await createQuote({
      customerId,
      items: [
        { serviceType: 'diseno_grafico', productName: e2eName('diseno'), quantity: 1, unitPrice: 1000 },
      ],
    });
    extraQuoteIds.push(quote.id);
    await apiPatch(`quotes/${quote.id}/status`, { status: 'aceptado' });
    const accepted = await apiGet<{ orderId?: string }>(`quotes/${quote.id}`);
    expect(accepted.orderId).toBeTruthy();
    extraOrderIds.push(accepted.orderId!);

    await gotoApp(page, `/pedidos/${accepted.orderId}`);
    await expect(page.getByText(/Desde presupuesto quo-/).locator('visible=true').first()).toBeVisible();
  });

  test('E87: una linea vacia dice "de la línea 1" en el pie', async ({ page }) => {
    await openNewOrder(page);
    await expect(page.locator('.order-form__footer')).toContainText('de la línea 1');
  });

  test('Pedido Entregado no muestra "Cancelar pedido"', async ({ page }) => {
    const pending = await newOrder();
    await gotoApp(page, `/pedidos/${pending.id}`);
    await expect(page.getByRole('button', { name: 'Cancelar pedido' }).first()).toBeVisible();

    const delivered = await newOrder();
    await apiPost(`orders/${delivered.id}/deliver-all`, {}, false);
    expect((await getOrder(delivered.id)).status).toBe('entregado');
    await gotoApp(page, `/pedidos/${delivered.id}`);
    await expect(page.getByRole('heading').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancelar pedido' })).toHaveCount(0);
  });
});
