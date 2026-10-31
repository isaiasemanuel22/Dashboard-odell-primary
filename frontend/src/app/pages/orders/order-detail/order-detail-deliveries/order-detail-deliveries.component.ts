import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import {
  Order,
  OrderDelivery,
  OrderItem,
  PrintJob,
  TaskKind,
} from '../../../../core/models';
import { OrdersService } from '../../../../core/services/orders.service';
import { DbButtonComponent, DbInputComponent } from '@general-components';
import { extractApiErrorMessage } from '../../../../shared/utils/api-error';
import { DateTimePipe } from '../../../../shared/pipes/labels.pipe';

@Component({
  selector: 'app-order-detail-deliveries',
  standalone: true,
  imports: [FormsModule, DbInputComponent, DbButtonComponent, DateTimePipe],
  templateUrl: './order-detail-deliveries.component.html',
  styleUrl: './order-detail-deliveries.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
})
export class OrderDetailDeliveriesComponent implements OnChanges {
  private readonly ordersService = inject(OrdersService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  @Input({ required: true }) order!: Order;
  @Input() tasks: PrintJob[] = [];
  @Input() deliveries: OrderDelivery[] = [];
  @Output() delivered = new EventEmitter<void>();

  deliveryDraft: number[] = [];
  deliveryLoading = false;
  deliveryError = '';

  ngOnChanges(changes: SimpleChanges): void {
    const orderChange = changes['order'];
    const orderChanged =
      !!orderChange &&
      (!orderChange.previousValue || orderChange.previousValue.id !== this.order.id);
    const deliveriesChanged = !!changes['deliveries'] && !changes['deliveries'].firstChange;
    if (orderChanged || deliveriesChanged) {
      this.deliveryDraft = this.order.items.map(() => 0);
    }
  }

  get canRegisterDelivery(): boolean {
    return (
      !this.deliveryLoading &&
      this.deliveryDraft.some((quantity) => Number(quantity) > 0)
    );
  }

  itemPending(item: OrderItem): number {
    return Math.max(item.quantity - (item.deliveredQuantity ?? item.delivered ?? 0), 0);
  }

  itemDeliverableMax(item: OrderItem, itemIndex: number): number {
    const pending = this.itemPending(item);
    if (pending <= 0) return 0;
    if (item.productId) {
      const reserved = item.reservedQuantity ?? item.reserved ?? 0;
      const produced = item.producedQuantity ?? item.produced ?? 0;
      return Math.min(
        pending,
        reserved + Math.max(produced - (item.deliveredFromProductionQuantity ?? 0), 0),
      );
    }
    const serviceDone = this.tasks.some(
      (task) =>
        task.orderItemIndex === itemIndex &&
        task.taskKind === TaskKind.SERVICE &&
        task.status === 'terminado',
    );
    const productionDone = this.tasks.some(
      (task) =>
        task.orderItemIndex === itemIndex &&
        task.taskKind === TaskKind.PRODUCTION &&
        task.status === 'terminado',
    );
    if (item.includesPrint) {
      return productionDone ? pending : 0;
    }
    return serviceDone ? pending : 0;
  }

  registerDelivery(): void {
    if (this.deliveryLoading) return;
    this.deliveryError = '';
    const items = this.deliveryDraft
      .map((quantity, orderItemIndex) => ({
        orderItemIndex,
        quantity: Math.trunc(Number(quantity) || 0),
      }))
      .filter((item) => item.quantity > 0);
    if (!items.length) {
      this.deliveryError = 'Indicá al menos una cantidad a entregar';
      this.cdr.markForCheck();
      return;
    }

    const overMax = items.find((line) => {
      const item = this.order.items[line.orderItemIndex];
      if (!item) return true;
      return line.quantity > this.itemDeliverableMax(item, line.orderItemIndex);
    });
    if (overMax) {
      const item = this.order.items[overMax.orderItemIndex]!;
      const max = this.itemDeliverableMax(item, overMax.orderItemIndex);
      this.deliveryError =
        max <= 0
          ? `No se puede entregar "${item.productName}": no hay unidades listas (faltan producir o terminar la tarea)`
          : `"${item.productName}" admite como máximo ${max} unidad(es)`;
      this.cdr.markForCheck();
      return;
    }

    this.deliveryLoading = true;
    this.cdr.markForCheck();
    this.ordersService
      .createDelivery(this.order.id, { items })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.deliveryLoading = false;
          this.deliveryError = '';
          this.delivered.emit();
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.deliveryLoading = false;
          this.deliveryError = extractApiErrorMessage(
            err,
            'No se pudo registrar la entrega',
          );
          this.cdr.markForCheck();
        },
      });
  }
}
