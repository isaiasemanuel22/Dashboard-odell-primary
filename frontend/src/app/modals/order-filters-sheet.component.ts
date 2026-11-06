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
  type AreaServiceType,
} from '../shared/constants/labels';
import {
  DbButtonComponent,
  MobileChipGroupComponent,
} from '@general-components';
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
  imports: [DbButtonComponent, MobileChipGroupComponent],
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

  /** Orden del artboard mobile (no cambia SERVICE_TYPE_LABELS de desktop). */
  readonly serviceOptions: { value: AreaServiceType; label: string }[] = (
    [
      ServiceType.IMPRESION_3D,
      ServiceType.ESTAMPADO,
      ServiceType.DISENO_GRAFICO,
      ServiceType.MODELADO,
    ] as AreaServiceType[]
  ).map((value) => ({
    value,
    label: SERVICE_TYPE_LABELS[value],
  }));

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

  onStatusesChange(statuses: OrderStatus[]): void {
    this.draft = { ...this.draft, statuses: [...statuses] };
    this.cdr.markForCheck();
  }

  onServicesChange(services: ServiceType[]): void {
    this.draft = { ...this.draft, services: [...services] };
    this.cdr.markForCheck();
  }

  onDeliveryChange(value: OrderDeliveryWindowFilter | null): void {
    this.draft = { ...this.draft, delivery: value };
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
