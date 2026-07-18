import {
  OrderStatus,
  PrintJobStatus,
  ProductType,
  ServiceType,
} from '../common/enums';
import {
  Order,
  PrintJob,
  Product,
} from '../common/interfaces';
import { ensureOrderStatusHistory } from '../orders/order-status-history.util';
import { createSeedState } from './store.seed';
import { StoreState } from './store.state';

const FIRST_NAMES = [
  'María',
  'Carlos',
  'Lucía',
  'Martín',
  'Sofía',
  'Diego',
  'Valentina',
  'Julián',
  'Camila',
  'Facundo',
];
const LAST_NAMES = [
  'González',
  'Ruiz',
  'Fernández',
  'López',
  'Martínez',
  'Díaz',
  'Romero',
  'Acosta',
  'Silva',
  'Morales',
];
const COMPANIES = [
  'Diseño Creativo SA',
  'Taller Mecánico Sur',
  'Emprendimientos Norte',
  'Estudio Pixel',
  'MakerLab Córdoba',
  'Textil Express',
  null,
  null,
];

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min: number, max: number, decimals = 0): number {
  const value = min + Math.random() * (max - min);
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function pick<T>(items: T[]): T {
  return items[randInt(0, items.length - 1)]!;
}

function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(randInt(8, 19), randInt(0, 59), 0, 0);
  return date.toISOString();
}

function remapId(prefix: string, run: string, index: number): string {
  return `${prefix}-${run}-${index}`;
}

function jitter(value: number, pct = 0.2): number {
  const delta = value * pct * (Math.random() * 2 - 1);
  return Math.max(1, Math.round(value + delta));
}

function buildPrintJobs(orders: Order[], run: string): PrintJob[] {
  const jobs: PrintJob[] = [];
  let jobIndex = 1;

  for (const order of orders) {
    if (
      order.status !== OrderStatus.EN_PRODUCCION &&
      order.status !== OrderStatus.PENDIENTE
    ) {
      continue;
    }

    order.items.forEach((item, itemIndex) => {
      if (item.serviceType !== ServiceType.IMPRESION_3D) return;

      const active =
        order.status === OrderStatus.EN_PRODUCCION && Math.random() > 0.35;
      const status = active
        ? pick([
            PrintJobStatus.POR_HACER,
            PrintJobStatus.EN_PROCESO,
            PrintJobStatus.BLOQUEADO,
          ])
        : PrintJobStatus.POR_HACER;

      jobs.push({
        id: remapId('job', run, jobIndex++),
        orderId: order.id,
        orderItemIndex: itemIndex,
        customerName: order.customerName,
        productName: item.productName,
        productId: item.productId,
        type: ServiceType.IMPRESION_3D,
        status,
        active,
        priority: randInt(1, 5),
        machine: pick(['Bambu P1S', 'Ender 3 V3', 'Saturn 4 Ultra', 'X1 Carbon']),
        estimatedHours: randFloat(1.5, 18, 1),
        dueDate: order.dueDate,
        startedAt:
          status === PrintJobStatus.EN_PROCESO ? daysAgo(randInt(0, 3)) : undefined,
      });
    });
  }

  return jobs;
}

function addExtraCustomers(state: StoreState, run: string, startIndex: number): void {
  const extra = randInt(2, 4);
  for (let i = 0; i < extra; i++) {
    const first = pick(FIRST_NAMES);
    const last = pick(LAST_NAMES);
    const name = `${first} ${last}`;
    const company = pick(COMPANIES);
    const slug = `${first}.${last}`.toLowerCase().replace(/\s+/g, '');
    state.customers.push({
      id: remapId('cust', run, startIndex + i),
      name,
      email: `${slug}${randInt(1, 99)}@demo.local`,
      phone: `+54 11 ${randInt(1000, 9999)}-${randInt(1000, 9999)}`,
      company: company ?? undefined,
      createdAt: daysAgo(randInt(5, 120)),
    });
  }
}

function addExtraOrders(state: StoreState, run: string, startIndex: number): void {
  const products = state.products.filter((p) => p.published);
  if (!products.length || !state.customers.length) return;

  const extra = randInt(2, 5);
  const statuses = [
    OrderStatus.PENDIENTE,
    OrderStatus.EN_PRODUCCION,
    OrderStatus.COMPLETADO,
    OrderStatus.ENTREGADO,
  ];

  for (let i = 0; i < extra; i++) {
    const customer = pick(state.customers);
    const product = pick(products);
    const qty = randInt(1, 8);
    const unitPrice = jitter(product.price, 0.05);
    const serviceType =
      product.type === ProductType.ESTAMPADO
        ? ServiceType.ESTAMPADO
        : ServiceType.IMPRESION_3D;

    const order: Order = {
      id: remapId('ord', run, startIndex + i),
      customerId: customer.id,
      customerName: customer.name,
      services: [serviceType],
      items: [
        {
          serviceType,
          productId: product.id,
          productName: product.name,
          quantity: qty,
          unitPrice,
        },
      ],
      status: pick(statuses),
      total: qty * unitPrice,
      description: `Pedido demo ${startIndex + i}`,
      notes: Math.random() > 0.5 ? 'Generado automáticamente' : undefined,
      createdAt: daysAgo(randInt(1, 45)),
      dueDate: daysAgo(-randInt(3, 20)),
    };
    ensureOrderStatusHistory(order);
    state.orders.push(order);
  }
}

/** Dataset demo con IDs y valores variados en cada invocación. */
export function createRandomSeedState(): StoreState {
  const run = Math.random().toString(36).slice(2, 7);
  const base = createSeedState();

  const idRemap = new Map<string, string>();
  const nextId = (oldId: string, prefix: string) => {
    if (!idRemap.has(oldId)) {
      const seq = idRemap.size + 1;
      idRemap.set(oldId, remapId(prefix, run, seq));
    }
    return idRemap.get(oldId)!;
  };

  const categories = base.categories.map((cat) => ({
    ...cat,
    id: nextId(cat.id, 'cat'),
    createdAt: daysAgo(randInt(30, 200)),
  }));

  const categoryIdMap = new Map(
    base.categories.map((cat, i) => [cat.id, categories[i]!.id]),
  );

  const products: Product[] = base.products.map((product) => {
    const remapped = {
      ...product,
      id: nextId(product.id, 'prod'),
      price: jitter(product.price),
      cost: jitter(product.cost),
      profit: jitter(product.profit),
      updatedAt: daysAgo(randInt(0, 30)),
      categoryIds: product.categoryIds.map(
        (cid) => categoryIdMap.get(cid) ?? cid,
      ),
      components: product.components?.map((c) => ({
        ...c,
        productId: idRemap.get(c.productId) ?? nextId(c.productId, 'prod'),
      })),
    } as Product;

    if (remapped.type !== ProductType.ESTAMPADO) {
      const p3d = remapped as Product & {
        grams?: number;
        printTimeHours?: number;
      };
      if (p3d.grams != null) p3d.grams = jitter(p3d.grams, 0.15);
      if (p3d.printTimeHours != null) {
        p3d.printTimeHours = randFloat(
          p3d.printTimeHours * 0.8,
          p3d.printTimeHours * 1.2,
          1,
        );
      }
    }

    return remapped;
  });

  const productIdMap = new Map(
    base.products.map((p, i) => [p.id, products[i]!.id]),
  );

  const customers = base.customers.map((customer) => ({
    ...customer,
    id: nextId(customer.id, 'cust'),
    createdAt: daysAgo(randInt(10, 180)),
  }));

  const customerIdMap = new Map(
    base.customers.map((c, i) => [c.id, customers[i]!.id]),
  );

  const orders: Order[] = base.orders.map((order) => {
    const remapped: Order = {
      ...order,
      id: nextId(order.id, 'ord'),
      customerId: order.customerId
        ? customerIdMap.get(order.customerId) ?? order.customerId
        : null,
      total: jitter(order.total, 0.1),
      createdAt: daysAgo(randInt(1, 60)),
      dueDate: daysAgo(-randInt(2, 25)),
      items: order.items.map((item) => ({
        ...item,
        productId: item.productId
          ? productIdMap.get(item.productId) ?? item.productId
          : undefined,
        unitPrice: jitter(item.unitPrice, 0.08),
        quantity: Math.max(1, item.quantity + randInt(-1, 2)),
      })),
      statusHistory: order.statusHistory?.map((entry, idx) => ({
        ...entry,
        id: `${nextId(order.id, 'ord')}-hist-${idx + 1}`,
        changedAt: daysAgo(randInt(1, 30)),
      })),
    };
    remapped.total = remapped.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0,
    );
    if (!remapped.statusHistory?.length) {
      ensureOrderStatusHistory(remapped);
    }
    return remapped;
  });

  const supplies = base.supplies.map((supply) => ({
    ...supply,
    id: nextId(supply.id, 'sup'),
    quantity: randFloat(0.3, 12, 1),
    unitPrice: jitter(supply.unitPrice, 0.12),
    updatedAt: daysAgo(randInt(0, 20)),
  }));

  const supplyIdMap = new Map(
    base.supplies.map((s, i) => [s.id, supplies[i]!.id]),
  );

  const generalSettings = {
    ...base.generalSettings,
    electricityCostPerKwh: randInt(70, 120),
    laborCostPerHour: randInt(600, 1200),
    powerConsumptions: base.generalSettings.powerConsumptions.map((entry) => ({
      ...entry,
      id: nextId(entry.id, 'pw'),
      watts: jitter(entry.watts, 0.1),
    })),
    machineCosts: base.generalSettings.machineCosts.map((entry) => ({
      ...entry,
      id: nextId(entry.id, 'mc'),
      costPerHour: jitter(entry.costPerHour, 0.15),
    })),
    machineProfiles: base.generalSettings.machineProfiles.map((profile) => ({
      ...profile,
      id: nextId(profile.id, 'mp'),
      washSupplyId: profile.washSupplyId
        ? supplyIdMap.get(profile.washSupplyId) ?? profile.washSupplyId
        : profile.washSupplyId,
    })),
    filamentPrices: base.generalSettings.filamentPrices.map((entry) => ({
      ...entry,
      id: nextId(entry.id, 'fp'),
      pricePerKg: jitter(entry.pricePerKg, 0.1),
    })),
    resinPrices: base.generalSettings.resinPrices.map((entry) => ({
      ...entry,
      id: nextId(entry.id, 'rp'),
      pricePerLiter: jitter(entry.pricePerLiter, 0.1),
    })),
  };

  const state: StoreState = {
    generalSettings,
    supplies,
    impresos: base.impresos.map((imp) => ({
      ...imp,
      id: nextId(imp.id, 'imp'),
      widthCm: randFloat(imp.widthCm * 0.9, imp.widthCm * 1.1, 1),
      heightCm: randFloat(imp.heightCm * 0.9, imp.heightCm * 1.1, 1),
      updatedAt: daysAgo(randInt(0, 40)),
    })),
    categories,
    products,
    customers,
    orders,
    printJobs: [],
    retailSales: base.retailSales.map((sale, saleIndex) => {
      const id = remapId('sale', run, saleIndex + 1);
      const items = sale.items.map((item) => ({
        ...item,
        productId: item.productId
          ? productIdMap.get(item.productId) ?? item.productId
          : undefined,
        quantity: Math.max(1, item.quantity + randInt(-1, 1)),
        unitPrice: jitter(item.unitPrice, 0.1),
        lineTotal: 0,
      }));
      items.forEach((item) => {
        item.lineTotal = item.quantity * item.unitPrice;
      });
      return {
        id,
        items,
        total: items.reduce((sum, item) => sum + item.lineTotal, 0),
        notes: sale.notes,
        soldAt: daysAgo(randInt(0, 15)),
        createdAt: daysAgo(randInt(0, 15)),
      };
    }),
    materials: base.materials.map((mat) => ({
      ...mat,
      id: nextId(mat.id, 'mat'),
      quantity: randFloat(0.2, mat.quantity * 1.5, 1),
    })),
  };

  addExtraCustomers(state, run, state.customers.length + 1);
  addExtraOrders(state, run, state.orders.length + 1);
  state.printJobs = buildPrintJobs(state.orders, run);

  return state;
}
