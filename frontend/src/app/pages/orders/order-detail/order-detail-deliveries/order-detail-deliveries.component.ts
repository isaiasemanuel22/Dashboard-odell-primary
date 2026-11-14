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
  OrderStatus,
  PrintJob,
  PrintJobStatus,
  TaskKind,
} from '../../../../core/models';
import { OrdersService } from '../../../../core/services/orders.service';
import {
  DbButtonComponent,
  DbInputComponent,
  MobileStepperComponent,
} from '@general-components';
import { FormDialogService } from '../../../../modals/public-api';
import { extractApiErrorMessage } from '../../../../shared/utils/api-error';
import {
  CurrencyArsPipe,
  DateTimePipe,
} from '../../../../shared/pipes/labels.pipe';
import {
  orderBalanceAmount,
  pluralize,
} from '../../../../shared/utils/order.helpers';
import { formatCurrencyArs } from '../../../../shared/utils/currency-ars.util';
import { isAreaService } from '../../../../shared/utils/service-type.util';

@Component({
  selector: 'app-order-detail-deliveries',
  standalone: true,
  imports: [
    FormsModule,
    DbInputComponent,
    DbButtonComponent,
    MobileStepperComponent,
    DateTimePipe,
    CurrencyArsPipe,
  ],
  templateUrl: './order-detail-deliveries.component.html',
  styleUrl: './order-detail-deliveries.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
})
export class OrderDetailDeliveriesComponent implements OnChanges {
  private readonly ordersService = inject(OrdersService);
  private readonly formDialogs = inject(FormDialogService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  /** full = panel desktop; summary = historial mobile; sheet = hoja inferior. */
  @Input() presentation: 'full' | 'summary' | 'sheet' = 'full';
  @Input({ required: true }) order!: Order;
  @Input() tasks: PrintJob[] = [];
  @Input() deliveries: OrderDelivery[] = [];
  @Output() delivered = new EventEmitter<void>();
  @Output() chargeBefore = new EventEmitter<void>();

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

  get canMarkDelivered(): boolean {
    return (
      !this.deliveryLoading &&
      this.order.status !== OrderStatus.ENTREGADO &&
      this.order.status !== OrderStatus.CANCELADO &&
      this.order.items.some((item) => this.itemPending(item) > 0)
    );
  }

  get hasOpenTasks(): boolean {
    return this.tasks.some(
      (task) =>
        !task.archived &&
        task.status !== PrintJobStatus.TERMINADO &&
        task.status !== PrintJobStatus.CANCELADO,
    );
  }

  /** Hay pendientes pero ninguna unidad lista: explica por qué no se puede entregar. */
  get nothingReadyToDeliver(): boolean {
    const pending = this.order.items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => this.itemPending(item) > 0);
    return (
      pending.length > 0 &&
      pending.every(({ item, index }) => this.itemDeliverableMax(item, index) === 0)
    );
  }

  get unpaidBalance(): number {
    return orderBalanceAmount(this.order);
  }

  get deliveryUnitsTotal(): number {
    return this.deliveryDraft.reduce(
      (sum, quantity) => sum + Math.max(0, Math.trunc(Number(quantity) || 0)),
      0,
    );
  }

  get deliveryUnitsLabel(): string {
    const units = this.deliveryUnitsTotal;
    if (units <= 0) return 'Entregar';
    return `Entregar ${pluralize(units, 'producto', 'productos')}`;
  }

  /** Prepara el formulario de entrega (el scroll lo hace el dock mobile). */
  prepareDelivery(): void {
    this.deliveryDraft = this.order.items.map((item, index) => {
      const max = this.itemDeliverableMax(item, index);
      return max > 0 ? max : 0;
    });
    this.deliveryError = '';
    this.cdr.markForCheck();
  }

  stepDelivery(itemIndex: number, delta: number): void {
    const item = this.order.items[itemIndex];
    if (!item) return;
    const max = this.itemDeliverableMax(item, itemIndex);
    const current = Math.trunc(Number(this.deliveryDraft[itemIndex]) || 0);
    this.setDeliveryQuantity(itemIndex, current + delta);
  }

  setDeliveryQuantity(itemIndex: number, quantity: number): void {
    const item = this.order.items[itemIndex];
    if (!item) return;
    const max = this.itemDeliverableMax(item, itemIndex);
    this.deliveryDraft[itemIndex] = Math.min(
      max,
      Math.max(0, Math.trunc(Number(quantity) || 0)),
    );
    this.cdr.markForCheck();
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
    // Insumo / servicio de tercero: espejo de serviceDeliverableQuantity (§15).
    if (!isAreaService(item.serviceType)) {
      return pending;
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

  /** Confirmación + entrega forzada de todo lo pendiente (también usable desde el dock). */
  confirmDeliverAll(): void {
    if (!this.canMarkDelivered) return;
    const openTasks = this.hasOpenTasks;
    const balance = this.unpaidBalance;
    let message = openTasks
      ? 'Se marcará todo como entregado, aunque haya tareas de producción sin terminar. Esas tareas se archivan.'
      : 'Se marcará todo como entregado.';
    if (balance > 0) {
      message += ` Queda un saldo de ${formatCurrencyArs(balance)} sin cobrar: se anota como deuda del cliente.`;
    }
    this.formDialogs
      .openConfirm({
        title: '¿Marcar todo como entregado?',
        message,
        confirmLabel: 'Marcar todo entregado',
        cancelLabel: 'Cancelar',
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.runDeliverAll();
      });
  }

  private runDeliverAll(): void {
    if (this.deliveryLoading) return;
    this.deliveryLoading = true;
    this.deliveryError = '';
    this.cdr.markForCheck();
    this.ordersService
      .deliverAll(this.order.id)
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
            'No se pudo marcar el pedido como entregado',
          );
          this.cdr.markForCheck();
        },
      });
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
