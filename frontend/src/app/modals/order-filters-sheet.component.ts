import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  inject,
} from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Order, OrderStatus, ServiceType } from '../core/models';
import {
  ORDER_STATUS_LABELS,
  SERVICE_TYPE_LABELS,
} from '../shared/constants/labels';
import { DbButtonComponent } from '@general-components';
import {
  OrderDeliveryWindowFilter,
  OrderMobileSheetFilters,
  emptyOrderMobileSheetFilters,
  matchesOrderMobileSheetFilters,
} from '../shared/utils/order.helpers';

export interface OrderFiltersSheetData {
  filters: OrderMobileSheetFilters;
  /** Lista ya acotada (p. ej. por chip + búsqueda) para el contador en vivo. */
  orders: Order[];
}

@Component({
  standalone: true,
  imports: [DbButtonComponent],
  templateUrl: './order-filters-sheet.component.html',
  styleUrl: './order-filters-sheet.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderFiltersSheetComponent {
  private readonly data = inject<OrderFiltersSheetData>(DIALOG_DATA);
  private readonly dialogRef =
    inject<DialogRef<OrderMobileSheetFilters | undefined>>(DialogRef);
  private readonly cdr = inject(ChangeDetectorRef);

  draft: OrderMobileSheetFilters = cloneFilters(this.data.filters);

  readonly statusOptions = (
    Object.entries(ORDER_STATUS_LABELS) as [OrderStatus, string][]
  ).map(([value, label]) => ({ value, label }));

  readonly serviceOptions = (
    Object.entries(SERVICE_TYPE_LABELS) as [ServiceType, string][]
  ).map(([value, label]) => ({ value, label }));

  readonly deliveryOptions: {
    value: OrderDeliveryWindowFilter;
    label: string;
  }[] = [
    { value: 'hoy', label: 'Hoy' },
    { value: 'semana', label: 'Esta semana' },
    { value: 'atrasados', label: 'Atrasados' },
  ];

  get matchCount(): number {
    return this.data.orders.filter((order) =>
      matchesOrderMobileSheetFilters(order, this.draft),
    ).length;
  }

  get applyLabel(): string {
    const n = this.matchCount;
    return n === 1 ? 'Ver 1 pedido' : `Ver ${n} pedidos`;
  }

  isStatusOn(status: OrderStatus): boolean {
    return this.draft.statuses.includes(status);
  }

  isServiceOn(service: ServiceType): boolean {
    return this.draft.services.includes(service);
  }

  toggleStatus(status: OrderStatus): void {
    this.draft = {
      ...this.draft,
      statuses: toggleInList(this.draft.statuses, status),
    };
    this.cdr.markForCheck();
  }

  toggleService(service: ServiceType): void {
    this.draft = {
      ...this.draft,
      services: toggleInList(this.draft.services, service),
    };
    this.cdr.markForCheck();
  }

  toggleDelivery(value: OrderDeliveryWindowFilter): void {
    this.draft = {
      ...this.draft,
      delivery: this.draft.delivery === value ? null : value,
    };
    this.cdr.markForCheck();
  }

  toggleBalanceOnly(): void {
    this.draft = {
      ...this.draft,
      balanceOnly: !this.draft.balanceOnly,
    };
    this.cdr.markForCheck();
  }

  clearAll(): void {
    this.draft = emptyOrderMobileSheetFilters();
    this.cdr.markForCheck();
  }

  apply(): void {
    this.dialogRef.close(cloneFilters(this.draft));
  }

  cancel(): void {
    this.dialogRef.close(undefined);
  }
}

function toggleInList<T>(list: T[], value: T): T[] {
  return list.includes(value)
    ? list.filter((item) => item !== value)
    : [...list, value];
}

function cloneFilters(
  filters: OrderMobileSheetFilters,
): OrderMobileSheetFilters {
  return {
    statuses: [...filters.statuses],
    services: [...filters.services],
    delivery: filters.delivery,
    balanceOnly: filters.balanceOnly,
  };
}
