import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
  OrderPayment,
  OrderPriceNotice,
  PrintJob,
  Customer,
  ServiceProfitMargins,
} from '../../../core/models';
import { RealtimeEvent } from '../../../core/models/realtime.model';
import { OrdersService } from '../../../core/services/orders.service';
import { PrintJobsService } from '../../../core/services/print-jobs.service';
import { CustomerCatalogService } from '../../../core/services/customer-catalog.service';
import { RealtimeCatalogSyncService } from '../../../core/services/realtime-catalog-sync.service';
import { RealtimeService } from '../../../core/services/realtime.service';
import { BreakpointService } from '../../../core/services/breakpoint.service';
import { LayoutUiService } from '../../../layout/layout-ui.service';
import {
  DbButtonComponent,
  DbSelectComponent,
  DbServiceBadgesComponent,
  DbSkeletonComponent,
  DbStateMessageComponent,
  DbStatusBadgeComponent,
  DB_DATA_TABLE,
  MobileBarComponent,
  OdlColumn,
} from '@general-components';
import {
  MobileDockAction,
  MobileDockComponent,
} from '../../../components/mobile-dock/mobile-dock.component';
import { FormDialogService } from '../../../modals/public-api';
import { SettingsFacade } from '../../../store/settings/settings.facade';
import { extractApiErrorMessage } from '../../../shared/utils/api-error';
import {
  ORDER_DESCRIPTION_MAX_LENGTH,
  calculateOrderSubtotal,
  calculateOrderDiscount,
  calculateLinePriceTotal,
  cancelOrderConfirmMessage,
  formatOrderMobileDeliveryLabel,
  isDesignService,
  orderBalanceAmount,
  orderDepositAmount,
  orderIsOverdue,
  orderOverdueDays,
  orderPaidAmount,
  pluralize,
} from '../../../shared/utils/order.helpers';
import { resolveLinePrintUnitPrice } from '../../../shared/utils/design-print.util';
import {
  TASK_KIND_LABELS,
  serviceTypeLabel,
} from '../../../shared/constants/labels';
import {
  CurrencyArsPipe,
  DateShortPipe,
  OrderStatusLabelPipe,
  PrintJobStatusLabelPipe,
  RichTextPipe,
  PlainTextLengthPipe,
} from '../../../shared/pipes/labels.pipe';
import { priorityTierClass } from '../../../shared/utils/priority.helpers';
import { markupPercentOnCostRounded } from '../../../shared/utils/product-margin.util';
import {
  DEFAULT_PROFIT_MARGINS,
  getMarginForService,
  normalizeProfitMargins,
} from '../../../shared/utils/pricing.util';
import { normalizeWholesaleDiscount } from '../../../shared/utils/wholesale-example.util';
import {
  paymentMethodLabel,
  salesChannelLabel,
  treasuryAccountLabel,
} from '../../../shared/utils/v1-labels.util';
import { OrderDetailHistoryComponent } from './order-detail-history/order-detail-history.component';
import { OrderDetailPaymentsComponent } from './order-detail-payments/order-detail-payments.component';
import { OrderDetailDeliveriesComponent } from './order-detail-deliveries/order-detail-deliveries.component';

type MobileAccordionKey = 'payments' | 'tasks' | 'deliveries' | 'history';

@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    DateShortPipe,
    CurrencyArsPipe,
    OrderStatusLabelPipe,
    PrintJobStatusLabelPipe,
    RichTextPipe,
    PlainTextLengthPipe,
    DbSelectComponent,
    DbButtonComponent,
    DbSkeletonComponent,
    DbStateMessageComponent,
    DbStatusBadgeComponent,
    DbServiceBadgesComponent,
    MobileBarComponent,
    MobileDockComponent,
    ...DB_DATA_TABLE,
    OrderDetailHistoryComponent,
    OrderDetailPaymentsComponent,
    OrderDetailDeliveriesComponent,
  ],
  templateUrl: './order-detail.component.html',
  styleUrl: './order-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderDetailComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly ordersService = inject(OrdersService);
  private readonly printJobsService = inject(PrintJobsService);
  private readonly catalogSync = inject(RealtimeCatalogSyncService);
  private readonly realtime = inject(RealtimeService);
  private readonly formDialogs = inject(FormDialogService);
  private readonly customerCatalog = inject(CustomerCatalogService);
  private readonly settingsFacade = inject(SettingsFacade);
  private readonly breakpoint = inject(BreakpointService);
  private readonly layoutUi = inject(LayoutUiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  @ViewChild('paymentSheet')
  private paymentSheet?: OrderDetailPaymentsComponent;

  @ViewChild('deliverySheet')
  private deliverySheet?: OrderDetailDeliveriesComponent;

  readonly isMobile = this.breakpoint.isMobile;

  order: Order | null = null;
  tasks: PrintJob[] = [];

  readonly lineColumns: OdlColumn<OrderItem>[] = [
    {
      key: 'service',
      header: 'Servicio',
      width: '6.5rem',
      value: (item) => serviceTypeLabel(item.serviceType),
    },
    { key: 'product', header: 'Concepto' },
    { key: 'quantity', header: 'Cant.', type: 'number', width: '3.25rem' },
    {
      key: 'stock',
      header: 'Stock',
      type: 'number',
      width: '3.5rem',
      value: (item) => this.itemFromStock(item),
    },
    {
      key: 'produce',
      header: 'A prod.',
      type: 'number',
      width: '3.75rem',
      value: (item) => this.itemToProduce(item),
    },
    {
      key: 'reserved',
      header: 'Res.',
      type: 'number',
      width: '3.25rem',
      value: (item) => this.itemReserved(item),
    },
    {
      key: 'produced',
      header: 'Hecho',
      type: 'number',
      width: '3.5rem',
      value: (item) => this.itemProduced(item),
    },
    {
      key: 'delivered',
      header: 'Ent.',
      type: 'number',
      width: '3.25rem',
      value: (item) => this.itemDelivered(item),
    },
    {
      key: 'pending',
      header: 'Pend.',
      type: 'number',
      width: '3.5rem',
      value: (item) => this.itemPending(item),
    },
    { key: 'unitPrice', header: 'P. unit.', width: '6.5rem' },
    {
      key: 'subtotal',
      header: 'Subtotal',
      type: 'money',
      width: '5.5rem',
      value: (item) => this.lineSubtotal(item),
    },
  ];

  hasWholesalePrice(item: OrderItem): boolean {
    return item.listUnitPrice != null && Number(item.listUnitPrice) > 0;
  }

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
  loading = true;
  notFound = false;

  assignCustomerId = '';
  assignLoading = false;
  assignCustomerOpen = false;
  private customers: Customer[] = [];

  statusLoading = false;
  previewImageUrl: string | null = null;

  mobileActionsOpen = false;
  mobileAlertsExpanded = false;
  mobilePaymentSheetOpen = false;
  mobileDeliverySheetOpen = false;
  private readonly mobileOpenAccordions = new Set<MobileAccordionKey>();
  private profitMargins: ServiceProfitMargins = { ...DEFAULT_PROFIT_MARGINS };
  private wholesalePercentSetting = 0;

  readonly descriptionMaxLength = ORDER_DESCRIPTION_MAX_LENGTH;
  readonly priorityTierClass = priorityTierClass;
  readonly taskKindLabels = TASK_KIND_LABELS;
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
    if (!item.productId) return 0;
    if (this.order?.status === OrderStatus.CANCELADO) return 0;
    return Math.max(
      this.itemPending(item) - this.itemToProduce(item) - this.itemProduced(item),
      0,
    );
  }

  get canEditOrder(): boolean {
    return (
      this.order?.status === OrderStatus.PENDIENTE ||
      this.order?.status === OrderStatus.EN_PROGRESO
    );
  }

  lineSubtotal(item: Order['items'][number]): number {
    return calculateLinePriceTotal(item);
  }

  printUnitPrice(item: Order['items'][number]): number {
    return resolveLinePrintUnitPrice(item);
  }

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
    const stored = [...(this.order?.priceHistory ?? [])];
    for (const notice of this.priceNotices) {
      const already = stored.some(
        (entry) =>
          entry.itemIndex === notice.itemIndex &&
          entry.previousUnitPrice === notice.agreedUnitPrice &&
          entry.newUnitPrice === notice.currentUnitPrice,
      );
      if (already) continue;
      stored.push({
        id: `notice-${this.order?.id ?? 'order'}-${notice.itemIndex}`,
        changedAt: new Date().toISOString(),
        trigger: 'product_update',
        itemIndex: notice.itemIndex,
        productId: notice.productId,
        productName: notice.productName,
        previousUnitPrice: notice.agreedUnitPrice,
        newUnitPrice: notice.currentUnitPrice,
        previousOrderTotal: this.order?.total ?? 0,
        newOrderTotal: this.order?.total ?? 0,
      });
    }
    return stored.sort(
      (a, b) =>
        new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime(),
    );
  }

  get customerOptions() {
    return this.customers.map((customer) => ({
      value: customer.id,
      label: customer.company
        ? `${customer.name} (${customer.company})`
        : customer.name,
    }));
  }

  get paidAmount(): number {
    return this.order ? orderPaidAmount(this.order) : 0;
  }

  get balanceAmount(): number {
    return this.order ? orderBalanceAmount(this.order) : 0;
  }

  get depositAmount(): number {
    return this.order ? orderDepositAmount(this.order) : 0;
  }

  get paidPercent(): number {
    if (!this.order || this.order.total <= 0) return 0;
    return Math.min(
      100,
      Math.round((this.paidAmount / Number(this.order.total)) * 100),
    );
  }

  get isOrderOverdue(): boolean {
    if (!this.order) return false;
    return orderIsOverdue(this.order.dueDate, this.order.status);
  }

  get overdueDays(): number {
    if (!this.order) return 0;
    return orderOverdueDays(this.order.dueDate, this.order.status);
  }

  get mobileCreatedLabel(): string {
    return this.order ? `Creado ${this.formatDayMonth(this.order.createdAt)}` : '';
  }

  get mobileDeliveryLabel(): string {
    if (!this.order) return '';
    return formatOrderMobileDeliveryLabel(
      this.order.dueDate,
      this.isOrderOverdue,
    ).replace(/^Entrega\b/, 'entrega');
  }

  /** «<1 %» cuando hay algo pagado pero el redondeo daría 0. */
  get paidPercentLabel(): string {
    const percent = this.paidPercent;
    return percent === 0 && this.paidAmount > 0 ? '<1 %' : `${percent} %`;
  }

  get salesChannelPill(): string | null {
    if (!this.order?.salesChannel) return null;
    const label = salesChannelLabel(this.order.salesChannel);
    return label ? `Canal: ${label}` : null;
  }

  get wholesalePill(): string | null {
    if (!this.order?.wholesaleApplied) return null;
    const percent = this.wholesaleDiscountPercent();
    if (percent == null || percent <= 0) return 'Mayorista';
    return `Mayorista · −${percent}%`;
  }

  get assignedCustomerPhone(): string | null {
    if (!this.order?.customerId) return null;
    const customer = this.customers.find((item) => item.id === this.order!.customerId);
    const phone = customer?.phone?.trim();
    return phone || null;
  }

  get whatsappHref(): string | null {
    const phone = this.assignedCustomerPhone;
    if (!phone) return null;
    const normalized = this.normalizeWhatsAppPhone(phone);
    return normalized ? `https://wa.me/${normalized}` : null;
  }

  get telHref(): string | null {
    const phone = this.assignedCustomerPhone;
    if (!phone) return null;
    const digits = phone.replace(/[^\d+]/g, '');
    return digits ? `tel:${digits}` : null;
  }

  get depositSummary(): string | null {
    if (!this.order) return null;
    const deposit = (this.order.payments ?? []).find((payment) => payment.deposit);
    if (!deposit) return null;
    return this.formatPaymentSummary(deposit);
  }

  get blockedTasksCount(): number {
    return this.tasks.filter((task) => task.status === 'bloqueado').length;
  }

  get tasksAccordionSummary(): string {
    if (!this.tasks.length) return 'Sin tareas';
    const blocked = this.blockedTasksCount;
    const tasksLabel = pluralize(this.tasks.length, 'tarea', 'tareas');
    if (blocked > 0) {
      return `${tasksLabel} · ${pluralize(blocked, 'bloqueada', 'bloqueadas')}`;
    }
    return tasksLabel;
  }

  get deliveriesAccordionSummary(): string {
    if (!this.deliveries.length) return 'Ninguna todavía';
    return pluralize(this.deliveries.length, 'entrega', 'entregas');
  }

  get historyAccordionSummary(): string {
    const changes = this.statusHistory.length + this.priceHistory.length;
    if (changes <= 0) return 'Sin cambios';
    return pluralize(changes, 'cambio', 'cambios');
  }

  get primaryAlert(): OrderAlert | null {
    return this.alerts[0] ?? null;
  }

  get extraAlerts(): OrderAlert[] {
    return this.alerts.slice(1);
  }

  get showMobileRegisterPayment(): boolean {
    return (
      !!this.order &&
      this.order.status !== OrderStatus.CANCELADO &&
      this.balanceAmount > 0
    );
  }

  get showMobileDeliver(): boolean {
    return (
      !!this.order &&
      this.order.status !== OrderStatus.CANCELADO &&
      this.order.status !== OrderStatus.ENTREGADO
    );
  }

  get showMobileDock(): boolean {
    return this.showMobileRegisterPayment || this.showMobileDeliver;
  }

  get mobileDockActions(): MobileDockAction[] {
    const actions: MobileDockAction[] = [];
    if (this.showMobileRegisterPayment) {
      actions.push({
        id: 'pay',
        label: 'Registrar pago',
        kind: 'secondary',
      });
    }
    if (this.showMobileDeliver) {
      actions.push({
        id: 'deliver',
        label: 'Entregar',
        kind: 'primary',
      });
    }
    return actions;
  }

  onMobileDockAction(id: string): void {
    if (id === 'pay') {
      this.openMobilePaymentsFromDock();
      return;
    }
    if (id === 'deliver') {
      this.openMobileDeliveriesFromDock();
    }
  }

  ngOnInit(): void {
    this.customerCatalog
      .getCustomers()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((customers) => {
        this.customers = customers;
        this.cdr.markForCheck();
      });

    this.settingsFacade
      .ensureLoaded()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (settings) => {
          this.profitMargins = normalizeProfitMargins(settings.profitMargins);
          this.wholesalePercentSetting = normalizeWholesaleDiscount(
            settings.wholesaleDiscount,
          ).percent;
          this.cdr.markForCheck();
        },
        error: () => {
          this.profitMargins = { ...DEFAULT_PROFIT_MARGINS };
          this.cdr.markForCheck();
        },
      });

    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const id = params.get('id');
        if (!id) {
          this.notFound = true;
          this.loading = false;
          this.cdr.markForCheck();
          return;
        }
        this.mobileActionsOpen = false;
        this.assignCustomerOpen = false;
        this.mobileAlertsExpanded = false;
        this.mobileOpenAccordions.clear();
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

  statusPillClass(status: OrderStatus | string): string {
    return `m-pill od-m__status od-m__status--${status}`;
  }

  isAccordionOpen(key: MobileAccordionKey): boolean {
    return this.mobileOpenAccordions.has(key);
  }

  toggleAccordion(key: MobileAccordionKey): void {
    // Uno abierto por vez: el detalle no se vuelve interminable.
    const wasOpen = this.mobileOpenAccordions.has(key);
    this.mobileOpenAccordions.clear();
    if (!wasOpen) this.mobileOpenAccordions.add(key);
    this.cdr.markForCheck();
  }

  openMobileActions(): void {
    this.mobileActionsOpen = true;
    this.cdr.markForCheck();
  }

  closeMobileActions(): void {
    if (!this.mobileActionsOpen) return;
    this.mobileActionsOpen = false;
    this.cdr.markForCheck();
  }

  onMobileEdit(): void {
    this.closeMobileActions();
    this.openEdit();
  }

  onMobileCancel(): void {
    this.closeMobileActions();
    this.cancelOrder();
  }

  openMobilePaymentsFromDock(): void {
    this.openPaymentSheet(this.balanceAmount);
  }

  openMobileDeliveriesFromDock(): void {
    this.openDeliverySheet();
  }

  closePaymentSheet(): void {
    if (!this.mobilePaymentSheetOpen) return;
    this.mobilePaymentSheetOpen = false;
    this.layoutUi.popOverlay();
    this.cdr.markForCheck();
  }

  closeDeliverySheet(): void {
    if (!this.mobileDeliverySheetOpen) return;
    this.mobileDeliverySheetOpen = false;
    this.layoutUi.popOverlay();
    this.cdr.markForCheck();
  }

  onChargeBeforeDelivery(): void {
    this.closeDeliverySheet();
    this.openPaymentSheet(this.balanceAmount);
  }

  ngOnDestroy(): void {
    if (this.mobilePaymentSheetOpen) this.layoutUi.popOverlay();
    if (this.mobileDeliverySheetOpen) this.layoutUi.popOverlay();
    this.mobilePaymentSheetOpen = false;
    this.mobileDeliverySheetOpen = false;
  }

  openAssignCustomer(): void {
    this.assignCustomerOpen = true;
    this.cdr.markForCheck();
  }

  toggleMobileAlerts(): void {
    this.mobileAlertsExpanded = !this.mobileAlertsExpanded;
    this.cdr.markForCheck();
  }

  lineAppliedUnitPrice(item: OrderItem): number {
    if (isDesignService(item.serviceType)) {
      const design = Number(item.designUnitPrice ?? item.unitPrice) || 0;
      if (item.includesPrint) return design + this.printUnitPrice(item);
      return design;
    }
    return Number(item.unitPrice) || 0;
  }

  lineHasListPrice(item: OrderItem): boolean {
    return this.hasWholesalePrice(item);
  }

  lineMarginPercent(item: OrderItem): number | null {
    const cost = Number(item.unitCost);
    if (!Number.isFinite(cost) || cost <= 0) return null;
    return markupPercentOnCostRounded(this.lineAppliedUnitPrice(item), cost);
  }

  lineMarginOk(item: OrderItem): boolean {
    const margin = this.lineMarginPercent(item);
    if (margin == null) return true;
    const minimum = getMarginForService(item.serviceType, this.profitMargins);
    return margin >= minimum;
  }

  lineProgressLabel(item: OrderItem): string {
    const produced = this.itemProduced(item);
    const delivered = this.itemDelivered(item);
    const total = delivered + this.itemPending(item);
    return `Preparar: ${produced} de ${total} · Entregado: ${delivered}`;
  }

  onDeliveryRegistered(): void {
    const order = this.order;
    if (!order) return;
    this.closeDeliverySheet();
    const balance = Math.max(
      0,
      Math.round(
        (order.total -
          (order.payments ?? []).reduce(
            (sum, payment) => sum + (Number(payment.amount) || 0),
            0,
          )) *
          100,
      ) / 100,
    );
    this.loadOrder(order.id);
    if (balance <= 0) return;

    const amount = new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0,
    }).format(balance);

    this.formDialogs
      .openConfirm({
        title: '¿El cliente pagó?',
        message: `La entrega quedó registrada y todavía hay ${amount} sin cobrar.`,
        confirmLabel: 'Registrar pago',
        cancelLabel: 'Ahora no',
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.openPaymentSheet(balance);
      });
  }

  loadOrder(id: string): void {
    this.loading = true;
    this.notFound = false;
    this.cdr.markForCheck();

    this.ordersService
      .getOrderOverview(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
      next: (overview) => {
        if (this.route.snapshot.paramMap.get('id') !== id) return;
        this.order = overview.order;
        this.tasks = overview.tasks;
        this.alerts = overview.alerts ?? [];
        this.priceNotices = overview.priceNotices ?? [];
        this.deliveries =
          overview.deliveries ?? overview.order.deliveryHistory ?? [];
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        if (this.route.snapshot.paramMap.get('id') !== id) return;
        this.loading = false;
        this.notFound = err.status === 404;
        this.cdr.markForCheck();
      },
    });
  }

  cancelOrder(): void {
    if (!this.order || this.statusLoading) return;
    if (this.order.status === OrderStatus.CANCELADO) return;

    const orderId = this.order.id;
    this.formDialogs
      .openConfirm({
        title: 'Cancelar pedido',
        message: cancelOrderConfirmMessage(this.order),
        confirmLabel: 'Cancelar pedido',
        cancelLabel: 'Volver',
        confirmVariant: 'delete',
      })
      .subscribe((confirmed) => {
        if (!confirmed || !this.order || this.order.id !== orderId) return;

        const previousStatus = this.order.status;
        this.statusLoading = true;
        this.cdr.markForCheck();

        this.ordersService
          .updateOrderStatus(orderId, OrderStatus.CANCELADO)
          .subscribe({
            next: (updated) => {
              this.statusLoading = false;
              this.order = updated;
              this.tasks = [];
              this.loadOrder(updated.id);
              this.cdr.markForCheck();
            },
            error: (err) => {
              this.statusLoading = false;
              if (this.order?.id === orderId) {
                this.order = { ...this.order, status: previousStatus };
              }
              this.cdr.markForCheck();
              this.formDialogs
                .openConfirm({
                  title: 'No se pudo cancelar',
                  message: extractApiErrorMessage(
                    err,
                    'No se pudo cancelar el pedido',
                  ),
                  confirmLabel: 'Entendido',
                  alertOnly: true,
                })
                .subscribe();
            },
          });
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
          this.assignCustomerOpen = false;
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
    this.cancelOrder();
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

  onPaymentRegistered(order: Order): void {
    this.order = order;
    this.closePaymentSheet();
    this.cdr.markForCheck();
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
    if (this.mobilePaymentSheetOpen) {
      this.closePaymentSheet();
      return;
    }
    if (this.mobileDeliverySheetOpen) {
      this.closeDeliverySheet();
      return;
    }
    if (this.mobileActionsOpen) {
      this.closeMobileActions();
      return;
    }
    this.closeImagePreview();
  }

  private openPaymentSheet(amount?: number): void {
    this.closeDeliverySheet();
    if (!this.mobilePaymentSheetOpen) {
      this.mobilePaymentSheetOpen = true;
      this.layoutUi.pushOverlay();
    }
    this.cdr.markForCheck();
    setTimeout(() => {
      const balance = amount ?? this.balanceAmount;
      if (balance > 0) {
        this.paymentSheet?.preparePayment(balance, { scroll: false });
      }
      this.cdr.markForCheck();
    }, 0);
  }

  private openDeliverySheet(): void {
    this.closePaymentSheet();
    if (!this.mobileDeliverySheetOpen) {
      this.mobileDeliverySheetOpen = true;
      this.layoutUi.pushOverlay();
    }
    this.cdr.markForCheck();
    setTimeout(() => {
      this.deliverySheet?.prepareDelivery();
      this.cdr.markForCheck();
    }, 0);
  }

  private wholesaleDiscountPercent(): number | null {
    if (!this.order?.wholesaleApplied) return null;
    for (const item of this.order.items) {
      const list = Number(item.listUnitPrice);
      const unit = Number(item.unitPrice);
      if (Number.isFinite(list) && list > 0 && Number.isFinite(unit) && unit < list) {
        return Math.round((1 - unit / list) * 100);
      }
    }
    return this.wholesalePercentSetting > 0 ? this.wholesalePercentSetting : null;
  }

  private formatDayMonth(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    return `${date.getDate()}/${date.getMonth() + 1}`;
  }

  private formatPaymentSummary(payment: OrderPayment): string {
    const amount = new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0,
    }).format(Number(payment.amount) || 0);
    const method = paymentMethodLabel(payment.method) || 'Efectivo';
    const account = treasuryAccountLabel(payment.account) || 'Caja efectivo';
    const date = this.formatDayMonth(payment.createdAt);
    return `Seña ${amount} · ${method} · ${account} · ${date}`;
  }

  private normalizeWhatsAppPhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('54')) return digits;
    if (digits.startsWith('0')) return `54${digits.slice(1)}`;
    return `54${digits}`;
  }
}
