import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Order, OrderStatus } from '../../core/models';
import { ORDER_STATUS_LABELS, serviceTypeLabel } from '../../shared/constants/labels';
import { CurrencyArsPipe } from '../../shared/pipes/labels.pipe';
import {
  formatOrderMobileDeliveryLabel,
  orderBalanceAmount,
  orderDepositAmount,
  orderIsOverdue,
  orderOverdueDays,
  orderPaidAmount,
  pluralize,
} from '../../shared/utils/order.helpers';
import { normalizeServiceType } from '../../shared/utils/service-type.util';

export type OrderMobilePaymentLine =
  | { kind: 'deposit'; deposit: number; balance: number }
  | { kind: 'paid'; paid: number; balance: number }
  | { kind: 'owes'; balance: number }
  | { kind: 'none' };

@Component({
  selector: 'app-order-mobile-card',
  standalone: true,
  imports: [RouterLink, CurrencyArsPipe],
  templateUrl: './order-mobile-card.component.html',
  styleUrl: './order-mobile-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderMobileCardComponent {
  readonly order = input.required<Order>();

  protected readonly overdue = computed(() => {
    const order = this.order();
    return orderIsOverdue(order.dueDate, order.status);
  });

  protected readonly overdueDays = computed(() => {
    const order = this.order();
    return orderOverdueDays(order.dueDate, order.status);
  });

  protected readonly overdueLabel = computed(() => {
    const days = this.overdueDays();
    return days > 0 ? `Atrasado ${pluralize(days, 'día', 'días')}` : '';
  });

  protected readonly accessibleName = computed(() => {
    const order = this.order();
    const status = this.overdue()
      ? this.overdueLabel()
      : this.statusLabel();
    const total = new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0,
    }).format(Number(order.total) || 0);
    return `${order.id}, ${order.customerName}, ${status}, ${total}`;
  });

  protected readonly summaryMeta = computed(() => {
    const order = this.order();
    const products = order.items.length;
    const units = order.items.reduce(
      (sum, item) => sum + (Number(item.quantity) || 0),
      0,
    );
    // Misma pluralización que order-card (desktop).
    const productWord = products === 1 ? 'producto' : 'productos';
    return `${order.id} · ${products} ${productWord} · ${units} u.`;
  });

  protected readonly statusLabel = computed(
    () => ORDER_STATUS_LABELS[this.order().status] ?? this.order().status,
  );

  protected readonly statusPillClass = computed(
    () => `m-pill omc__status omc__status--${this.order().status}`,
  );

  protected readonly areaLabels = computed(() =>
    this.order().services.map((service) => serviceAreaLabel(service)),
  );

  protected readonly deliveryLabel = computed(() => {
    const order = this.order();
    return formatOrderMobileDeliveryLabel(order.dueDate, this.overdue());
  });

  protected readonly paymentLine = computed((): OrderMobilePaymentLine | null =>
    orderMobilePaymentLine(this.order()),
  );
}

/** Misma resolución que el detalle (badge + valores heredados como «diseno»). */
export function serviceAreaLabel(service: string): string {
  const normalized = normalizeServiceType(service);
  if (normalized) return serviceTypeLabel(normalized);
  return service;
}

export function orderMobilePaymentLine(
  order: Pick<Order, 'total' | 'payments' | 'status'>,
): OrderMobilePaymentLine | null {
  const balance = orderBalanceAmount(order);
  if (balance <= 0) return null;

  const deposit = orderDepositAmount(order);
  const paid = orderPaidAmount(order);
  // «Seña» solo si lo cobrado es exactamente la seña; con más pagos, «Pagado».
  if (deposit > 0 && paid > 0 && deposit === paid) {
    return { kind: 'deposit', deposit, balance };
  }
  if (paid > 0) {
    return { kind: 'paid', paid, balance };
  }

  if (order.status === OrderStatus.CANCELADO) return null;
  // Ya entregado y sin cobrar: es una deuda, no «sin pagos».
  if (order.status === OrderStatus.ENTREGADO) return { kind: 'owes', balance };
  return { kind: 'none' };
}
