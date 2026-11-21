import { Order } from '../common/interfaces';
import { arTodayKey } from '../common/utils/ar-date.util';
import { ReceivablesSummary } from '../dashboard/receivables.util';
import {
  calendarDay,
  isOrderDueOn,
  isOrderOverdue,
} from '../orders/due-date.util';
import { addCalendarDaysToKey } from '../supplies/business-days.util';
import { ReorderRow } from '../supplies/supplies-reorder.service';

type DigestOrder = Pick<
  Order,
  'id' | 'customerName' | 'status' | 'dueDate' | 'total'
>;

export function formatMoney(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(value);
}

/** YYYY-MM-DD → DD/MM. */
function formatDay(dayKey: string): string {
  const [, month, day] = dayKey.split('-');
  return `${day}/${month}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Pedidos atrasados y que vencen mañana (día de Argentina). Sin pedidos, texto vacío. */
export function buildOrdersDueDigest<T extends DigestOrder>(
  orders: T[],
  now = new Date(),
): { overdue: T[]; dueTomorrow: T[]; text: string } {
  const tomorrow = addCalendarDaysToKey(arTodayKey(now), 1);
  const overdue = orders.filter((order) => isOrderOverdue(order, now));
  const dueTomorrow = orders.filter((order) => isOrderDueOn(order, tomorrow));
  if (!overdue.length && !dueTomorrow.length) {
    return { overdue, dueTomorrow, text: '' };
  }

  const line = (order: T, withDue: boolean) => {
    const due = calendarDay(order.dueDate);
    const dueText = withDue && due ? ` · vencía ${formatDay(due)}` : '';
    return `• ${order.id} · ${order.customerName}${dueText} · ${formatMoney(order.total)}`;
  };
  const parts: string[] = [];
  if (overdue.length) {
    parts.push(
      `Pedidos atrasados (${overdue.length}):`,
      ...overdue.map((order) => line(order, true)),
    );
  }
  if (dueTomorrow.length) {
    if (parts.length) parts.push('');
    parts.push(
      `Vencen mañana ${formatDay(tomorrow)} (${dueTomorrow.length}):`,
      ...dueTomorrow.map((order) => line(order, false)),
    );
  }
  return { overdue, dueTomorrow, text: parts.join('\n') };
}

/** Resumen semanal de saldos por cobrar (mismo dato que el KPI del Dashboard). */
export function buildReceivablesEmail(receivables: ReceivablesSummary): {
  subject: string;
  html: string;
  text: string;
} {
  const total = formatMoney(receivables.clientDebt);
  const subject = `Saldos por cobrar: ${total}`;
  const header = `${receivables.orderCount} ${
    receivables.orderCount === 1 ? 'pedido entregado' : 'pedidos entregados'
  } con saldo, total ${total}.`;

  const textRows = receivables.rows.flatMap((row) => [
    `${row.customerName}: ${formatMoney(row.amount)}`,
    ...row.orders.map(
      (order) => `  • ${order.id} · ${formatMoney(order.amount)}`,
    ),
  ]);
  const htmlRows = receivables.rows
    .map(
      (row) =>
        `<li><strong>${escapeHtml(row.customerName)}</strong>: ${formatMoney(row.amount)}<ul>${row.orders
          .map(
            (order) =>
              `<li>${escapeHtml(order.id)} · ${formatMoney(order.amount)}</li>`,
          )
          .join('')}</ul></li>`,
    )
    .join('');

  return {
    subject,
    text: [header, '', ...textRows].join('\n'),
    html: `<p>${header}</p><ul>${htmlRows}</ul>`,
  };
}

/** Insumos sin stock, bajo el mínimo o con «pedir antes del» que vence hoy o ya venció. */
export function stockAlertRows(
  rows: ReorderRow[],
  todayKey: string,
): ReorderRow[] {
  return rows.filter(
    (row) =>
      row.reason === 'out_of_stock' ||
      row.reason === 'below_min' ||
      (row.reason === 'forecast' && !!row.orderBy && row.orderBy <= todayKey),
  );
}

/** Texto de WhatsApp para los insumos nuevos en la lista. */
export function buildStockAlertText(rows: ReorderRow[]): string {
  const detail = (row: ReorderRow) => {
    if (row.reason === 'out_of_stock') return 'sin stock';
    if (row.reason === 'below_min') {
      return `${row.stock} ${row.unit} (bajo el mínimo)`;
    }
    const supplier = row.supplier ? ` a ${row.supplier.name}` : '';
    return `pedir${supplier} antes del ${formatDay(row.orderBy ?? '')}`;
  };
  return [
    'Stock bajo:',
    ...rows.map((row) => `• ${row.name}: ${detail(row)}`),
  ].join('\n');
}
