import { OrderStatus } from '../common/enums';
import { ClientReceivable } from '../common/interfaces';
import { outstandingCents } from '../common/utils/money.util';
import { resolveOrderSoldAt } from '../sales/sales-order.util';
import { StoreService } from '../store/store.service';

export interface ReceivablesSummary {
  clientDebt: number;
  rows: ClientReceivable[];
  orderCount: number;
}

/** Saldo impago de pedidos ya entregados. No entra en la caja. */
export function computeReceivables(
  store: Pick<StoreService, 'orders' | 'getCustomerById'>,
): ReceivablesSummary {
  const grouped = new Map<
    string,
    {
      customerId: string;
      customerName: string;
      phone?: string;
      company?: string;
      cents: number;
      orders: ClientReceivable['orders'];
    }
  >();
  let totalCents = 0;
  let orderCount = 0;

  for (const order of store.orders) {
    if (order.status !== OrderStatus.ENTREGADO) continue;
    const cents = outstandingCents(order);
    if (cents <= 0) continue;
    totalCents += cents;
    orderCount += 1;
    const key = order.customerId || order.customerName;
    const customer = order.customerId
      ? store.getCustomerById(order.customerId)
      : undefined;
    const row = grouped.get(key) ?? {
      customerId: order.customerId ?? '',
      customerName: order.customerName,
      phone: customer?.phone || undefined,
      company: customer?.company || undefined,
      cents: 0,
      orders: [] as ClientReceivable['orders'],
    };
    row.cents += cents;
    row.orders.push({
      id: order.id,
      amount: cents / 100,
      total: Number(order.total) || 0,
      deliveredAt: resolveOrderSoldAt(order),
      summary: receivableSummary(order),
    });
    grouped.set(key, row);
  }

  const rows = [...grouped.values()]
    .map((row) => ({
      customerId: row.customerId,
      customerName: row.customerName,
      ...(row.phone ? { phone: row.phone } : {}),
      ...(row.company ? { company: row.company } : {}),
      amount: row.cents / 100,
      orders: row.orders,
    }))
    .sort(
      (a, b) =>
        b.amount - a.amount ||
        a.customerName.localeCompare(b.customerName, 'es'),
    );

  return { clientDebt: totalCents / 100, rows, orderCount };
}

function receivableSummary(order: {
  items?: { productName?: string }[];
  description?: string;
}): string {
  const names = (order.items ?? [])
    .map((item) => item.productName?.trim())
    .filter((name): name is string => !!name);
  if (names.length) return names.join(' · ');
  return (order.description ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
