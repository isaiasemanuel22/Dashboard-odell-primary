import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  inject,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  Order,
  OrderItem,
  OrderStatus,
  OrderStatusHistoryEntry,
  OrderPriceHistoryEntry,
  OrderAlert,
  OrderDelivery,
  OrderPriceNotice,
  PrintJob,
  Customer,
} from '../../../core/models';
import { RealtimeEvent } from '../../../core/models/realtime.model';
import { OrdersService } from '../../../core/services/orders.service';
import { PrintJobsService } from '../../../core/services/print-jobs.service';
import { CustomerCatalogService } from '../../../core/services/customer-catalog.service';
import { RealtimeCatalogSyncService } from '../../../core/services/realtime-catalog-sync.service';
import { RealtimeService } from '../../../core/services/realtime.service';
import {
  DbButtonComponent,
  DbCheckboxComponent,
  DbInputComponent,
  DbSelectComponent,
  DbServiceBadgesComponent,
  DbSkeletonComponent,
  DbStateMessageComponent,
  DbStatusBadgeComponent,
  DB_DATA_TABLE,
  OdlColumn,
} from '@general-components';
import { FormDialogService } from '../../../shared/form-dialogs/public-api';
import { extractApiErrorMessage } from '../../../shared/utils/api-error';
import {
  ORDER_DESCRIPTION_MAX_LENGTH,
  calculateOrderSubtotal,
  calculateOrderDiscount,
  calculateLinePriceTotal,
  isDesignService,
} from '../../../shared/utils/order.helpers';
import { resolveLinePrintUnitPrice } from '../../../shared/utils/design-print.util';
import {
  ORDER_STATUS_CHANGE_SOURCE_LABELS,
  ORDER_STATUS_LABELS,
  TASK_KIND_LABELS,
  SERVICE_TYPE_LABELS,
} from '../../../shared/constants/labels';
import {
  CurrencyArsPipe,
  DateShortPipe,
  DateTimePipe,
  OrderStatusLabelPipe,
  PrintJobStatusLabelPipe,
  RichTextPipe,
  PlainTextLengthPipe,
} from '../../../shared/pipes/labels.pipe';
import { priorityTierClass } from '../../../shared/utils/priority.helpers';

@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    DateShortPipe,
    DateTimePipe,
    CurrencyArsPipe,
    OrderStatusLabelPipe,
    PrintJobStatusLabelPipe,
    RichTextPipe,
    PlainTextLengthPipe,
    DbSelectComponent,
    DbButtonComponent,
    DbInputComponent,
    DbCheckboxComponent,
    DbSkeletonComponent,
    DbStateMessageComponent,
    DbStatusBadgeComponent,
    DbServiceBadgesComponent,
    ...DB_DATA_TABLE,
  ],
  templateUrl: './order-detail.component.html',
  styleUrl: './order-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly ordersService = inject(OrdersService);
  private readonly printJobsService = inject(PrintJobsService);
  private readonly catalogSync = inject(RealtimeCatalogSyncService);
  private readonly realtime = inject(RealtimeService);
  private readonly formDialogs = inject(FormDialogService);
  private readonly customerCatalog = inject(CustomerCatalogService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  order: Order | null = null;
  tasks: PrintJob[] = [];

  readonly lineColumns: OdlColumn<OrderItem>[] = [
    { key: 'service', header: 'Servicio', value: (item) => SERVICE_TYPE_LABELS[item.serviceType] },
    { key: 'product', header: 'Concepto / producto' },
    { key: 'quantity', header: 'Cant.', type: 'number' },
    { key: 'stock', header: 'Stock', type: 'number', value: (item) => this.itemFromStock(item) },
    { key: 'produce', header: 'A producir', type: 'number', value: (item) => this.itemToProduce(item) },
    { key: 'reserved', header: 'Reservado', type: 'number', value: (item) => this.itemReserved(item) },
    { key: 'produced', header: 'Producido', type: 'number', value: (item) => this.itemProduced(item) },
    { key: 'delivered', header: 'Entregado', type: 'number', value: (item) => this.itemDelivered(item) },
    { key: 'pending', header: 'Pendiente', type: 'number', value: (item) => this.itemPending(item) },
    { key: 'unitPrice', header: 'Precio unit.' },
    { key: 'subtotal', header: 'Subtotal', type: 'money', value: (item) => this.lineSubtotal(item) },
  ];

  readonly taskColumns: OdlColumn<PrintJob>[] = [
    {
      key: 'productName',
      header: 'Tarea',
      type: 'primary',
      note: (task) =>
        task.status === 'bloqueado' && task.blockedReason
          ? { text: `Bloqueo: ${task.blockedReason}`, tone: 'danger' }
          : null,
    },
    { key: 'taskKind', header: 'Tipo', value: (task) => this.taskKindLabels[task.taskKind] },
    { key: 'status', header: 'Estado' },
    { key: 'active', header: 'Ubicación', value: (task) => (task.active ? 'Tablero' : 'Pendiente') },
    { key: 'dueDate', header: 'Entrega', type: 'date' },
  ];
  alerts: OrderAlert[] = [];
  priceNotices: OrderPriceNotice[] = [];
  priceDecisionLoading = false;
  deliveries: OrderDelivery[] = [];
  deliveryDraft: number[] = [];
  deliveryLoading = false;
  loading = true;
  notFound = false;

  assignCustomerId = '';
  assignLoading = false;
  paymentAmount: number | null = null;
  paymentDeposit = false;
  paymentLoading = false;
  paymentError = '';
  private customers: Customer[] = [];

  statusLoading = false;
  previewImageUrl: string | null = null;

  readonly descriptionMaxLength = ORDER_DESCRIPTION_MAX_LENGTH;
  readonly priorityTierClass = priorityTierClass;
  readonly sourceLabels = ORDER_STATUS_CHANGE_SOURCE_LABELS;
  readonly isDesignService = isDesignService;

  itemPending(item: OrderItem): number {
    return Math.max(item.quantity - this.itemDelivered(item), 0);
  }

  itemToProduce(item: OrderItem): number {
    return item.productionRequiredQuantity ?? item.toProduce ?? 0;
  }

  itemReserved(item: OrderItem): number {
    return item.reservedQuantity ?? item.reserved ?? 0;
  }

  itemProduced(item: OrderItem): number {
    return item.producedQuantity ?? item.produced ?? 0;
  }

  itemDelivered(item: OrderItem): number {
    return item.deliveredQuantity ?? item.delivered ?? 0;
  }

  itemFromStock(item: OrderItem): number {
    return Math.max(
      this.itemPending(item) - this.itemToProduce(item) - this.itemProduced(item),
      0,
    );
  }

  get paidAmount(): number {
    return (this.order?.payments ?? []).reduce(
      (sum, payment) => sum + (Number(payment.amount) || 0),
      0,
    );
  }

  get balanceAmount(): number {
    if (!this.order) return 0;
    return Math.max(0, Math.round((this.order.total - this.paidAmount) * 100) / 100);
  }

  get paymentStatusLabel(): string {
    if (this.paidAmount <= 0) return 'No pagado';
    if (this.balanceAmount <= 0) return 'Pagado';
    return 'Parcialmente pagado';
  }

  registerPayment(): void {
    if (!this.order || this.paymentLoading || !this.paymentAmount) return;
    this.paymentLoading = true;
    this.paymentError = '';
    this.cdr.markForCheck();
    this.ordersService
      .addPayment(this.order.id, {
        amount: Number(this.paymentAmount),
        deposit: this.paymentDeposit,
      })
      .subscribe({
        next: (order) => {
          this.order = order;
          this.paymentAmount = null;
          this.paymentDeposit = false;
          this.paymentLoading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.paymentLoading = false;
          this.paymentError = extractApiErrorMessage(
            err,
            'No se pudo registrar el pago',
          );
          this.cdr.markForCheck();
        },
      });
  }

  lineSubtotal(item: Order['items'][number]): number {
    return calculateLinePriceTotal(item);
  }

  printUnitPrice(item: Order['items'][number]): number {
    return resolveLinePrintUnitPrice(item);
  }
  readonly taskKindLabels = TASK_KIND_LABELS;
  readonly priceTriggerLabels: Record<OrderPriceHistoryEntry['trigger'], string> = {
    settings: 'Ajustes del sistema',
    supply_price: 'Precio de insumo',
    product_update: 'Actualización de producto',
  };

  get orderSubtotal(): number {
    if (!this.order) return 0;
    return calculateOrderSubtotal(this.order.items);
  }

  get orderDiscount(): number {
    if (!this.order) return 0;
    return calculateOrderDiscount(
      this.order.items,
      this.order.discountPercent ?? 0,
      this.order.discountAmount ?? 0,
    );
  }

  get statusHistory(): OrderStatusHistoryEntry[] {
    if (!this.order?.statusHistory?.length) return [];
    return [...this.order.statusHistory].sort(
      (a, b) =>
        new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime(),
    );
  }

  get priceHistory(): OrderPriceHistoryEntry[] {
    if (!this.order?.priceHistory?.length) return [];
    return [...this.order.priceHistory].sort(
      (a, b) =>
        new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime(),
    );
  }

  get canRegisterDelivery(): boolean {
    return (
      !this.deliveryLoading &&
      this.deliveryDraft.some((quantity) => Number(quantity) > 0)
    );
  }

  historyTransition(entry: OrderStatusHistoryEntry): string {
    if (entry.fromStatus === null) {
      return `Creación → ${ORDER_STATUS_LABELS[entry.toStatus]}`;
    }
    return `${ORDER_STATUS_LABELS[entry.fromStatus]} → ${ORDER_STATUS_LABELS[entry.toStatus]}`;
  }

  get customerOptions() {
    return this.customers.map((customer) => ({
      value: customer.id,
      label: customer.company
        ? `${customer.name} (${customer.company})`
        : customer.name,
    }));
  }

  ngOnInit(): void {
    this.customerCatalog.getCustomers().subscribe((customers) => {
      this.customers = customers;
      this.cdr.markForCheck();
    });

    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (!id) {
        this.notFound = true;
        this.loading = false;
        this.cdr.markForCheck();
        return;
      }
      this.loadOrder(id);
    });

    this.realtime.bindSmartReload(
      this.destroyRef,
      ['orders', 'print-jobs', 'customers', 'products'],
      (event) => this.handleRealtime(event),
      {
        skip: () => this.statusLoading,
      },
    );
  }

  loadOrder(id: string): void {
    this.loading = true;
    this.notFound = false;
    this.cdr.markForCheck();

    this.ordersService.getOrderOverview(id).subscribe({
      next: (overview) => {
        this.order = overview.order;
        this.tasks = overview.tasks;
        this.alerts = overview.alerts ?? [];
        this.priceNotices = overview.priceNotices ?? [];
        this.deliveries =
          overview.deliveries ?? overview.order.deliveryHistory ?? [];
        this.deliveryDraft = overview.order.items.map(() => 0);
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loading = false;
        this.notFound = err.status === 404;
        this.cdr.markForCheck();
      },
    });
  }

  cancelOrder(): void {
    if (!this.order || this.statusLoading) return;
    if (this.order.status === OrderStatus.CANCELADO) return;
    if (!confirm(`¿Cancelar el pedido ${this.order.id}?`)) return;

    const previousStatus = this.order.status;
    this.statusLoading = true;
    this.cdr.markForCheck();

    this.ordersService
      .updateOrderStatus(this.order.id, OrderStatus.CANCELADO)
      .subscribe({
        next: (updated) => {
          this.statusLoading = false;
          this.order = updated;
          this.loadOrder(updated.id);
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.statusLoading = false;
          this.order = { ...this.order!, status: previousStatus };
          this.cdr.markForCheck();
          alert(
            extractApiErrorMessage(err, 'No se pudo cancelar el pedido'),
          );
        },
      });
  }

  openEdit(): void {
    if (!this.order) return;

    this.formDialogs.openOrder(this.order).subscribe((updated) => {
      if (!updated) return;
      this.order = updated;
      this.reloadTasks(updated.id);
      this.cdr.markForCheck();
    });
  }

  assignCustomer(): void {
    if (!this.order || !this.assignCustomerId || this.assignLoading) return;

    this.assignLoading = true;
    this.cdr.markForCheck();

    this.ordersService
      .updateOrder(this.order.id, { customerId: this.assignCustomerId })
      .subscribe({
        next: (updated) => {
          this.assignLoading = false;
          this.order = updated;
          this.assignCustomerId = '';
          this.reloadTasks(updated.id);
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.assignLoading = false;
          this.cdr.markForCheck();
          alert(
            extractApiErrorMessage(err, 'No se pudo asignar el cliente'),
          );
        },
      });
  }

  openNewCustomer(): void {
    if (!this.order) return;

    this.formDialogs.openCustomer().subscribe((customer) => {
      if (!customer) return;

      const exists = this.customers.some((item) => item.id === customer.id);
      this.customers = exists
        ? this.customers.map((item) =>
            item.id === customer.id ? customer : item,
          )
        : [...this.customers, customer].sort((a, b) =>
            a.name.localeCompare(b.name, 'es'),
          );

      this.assignCustomerId = customer.id;
      this.assignCustomer();
    });
  }

  deleteOrder(): void {
    if (!this.order) return;
    if (!confirm(`¿Eliminar el pedido ${this.order.id}?`)) return;

    this.ordersService.deleteOrder(this.order.id).subscribe({
      next: () => this.router.navigate(['/pedidos']),
      error: (err) => {
        alert(extractApiErrorMessage(err, 'No se pudo eliminar el pedido'));
      },
    });
  }

  private handleRealtime(event: RealtimeEvent): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;

    this.catalogSync.handleEvent(event);

    if (
      event.scope === 'orders' ||
      event.scope === 'print-jobs' ||
      event.scope === 'all' ||
      (event.entity === 'order' && event.id === id)
    ) {
      this.loadOrder(id);
    }
  }

  private reloadTasks(orderId: string): void {
    this.printJobsService.getPrintJobsByOrder(orderId).subscribe({
      next: (tasks) => {
        this.tasks = tasks;
        this.cdr.markForCheck();
      },
    });
  }

  decideProductPrice(action: 'apply' | 'keep'): void {
    if (!this.order || this.priceDecisionLoading) return;
    this.priceDecisionLoading = true;
    this.cdr.markForCheck();
    this.ordersService.decideOrderPrice(this.order.id, action).subscribe({
      next: () => {
        this.priceDecisionLoading = false;
        this.loadOrder(this.order!.id);
      },
      error: (err) => {
        this.priceDecisionLoading = false;
        this.cdr.markForCheck();
        alert(
          extractApiErrorMessage(
            err,
            'No se pudo actualizar el precio del pedido',
          ),
        );
      },
    });
  }

  registerDelivery(): void {
    if (!this.order || this.deliveryLoading) return;
    const items = this.deliveryDraft
      .map((quantity, orderItemIndex) => ({
        orderItemIndex,
        quantity: Math.trunc(Number(quantity) || 0),
      }))
      .filter((item) => item.quantity > 0);
    if (!items.length) return;

    this.deliveryLoading = true;
    this.ordersService.createDelivery(this.order.id, { items }).subscribe({
      next: () => {
        this.deliveryLoading = false;
        this.loadOrder(this.order!.id);
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.deliveryLoading = false;
        this.cdr.markForCheck();
        alert(extractApiErrorMessage(err, 'No se pudo registrar la entrega'));
      },
    });
  }

  onDescriptionClick(event: MouseEvent): void {
    const target = event.target;
    if (!(target instanceof HTMLImageElement)) return;
    if (!target.closest('.order-description')) return;

    this.previewImageUrl = target.currentSrc || target.src;
    this.cdr.markForCheck();
  }

  closeImagePreview(): void {
    if (!this.previewImageUrl) return;
    this.previewImageUrl = null;
    this.cdr.markForCheck();
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    this.closeImagePreview();
  }
}
