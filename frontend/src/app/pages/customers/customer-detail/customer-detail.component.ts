import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import {
  Customer,
  CustomerType,
  Order,
  OrderStatus,
} from '../../../core/models';
import { CustomersService } from '../../../core/services/customers.service';
import { OrdersService } from '../../../core/services/orders.service';
import { SettingsFacade } from '../../../store/settings/settings.facade';
import {
  DbButtonComponent,
  DbStateMessageComponent,
  MobileBarComponent,
  MobileContactCardComponent,
  MobileDockComponent,
  MobileKpiGridComponent,
  MobileSheetComponent,
  OrdersTableComponent,
  type MobileContactPill,
  type MobileDockAction,
  type MobileKpiItem,
} from '@general-components';
import { FormDialogService } from '../../../modals/public-api';
import { extractApiErrorMessage } from '../../../shared/utils/api-error';
import {
  formatOrderMobileDeliveryLabel,
  isActiveOrder,
  isFinishedOrder,
  orderBalanceAmount,
  orderHasPendingBalance,
  orderIsOverdue,
  pluralize,
} from '../../../shared/utils/order.helpers';
import { formatPhoneArDisplay } from '../../../shared/utils/phone-ar.util';
import {
  CurrencyArsPipe,
  DateShortPipe,
} from '../../../shared/pipes/labels.pipe';
import { ORDER_STATUS_LABELS } from '../../../shared/constants/labels';
import {
  customerSourceLabel,
  customerTypeLabel,
} from '../../../shared/utils/v1-labels.util';
import { normalizeWholesaleDiscount } from '../../../shared/utils/wholesale-example.util';

@Component({
  selector: 'app-customer-detail',
  standalone: true,
  imports: [
    RouterLink,
    DateShortPipe,
    CurrencyArsPipe,
    DbButtonComponent,
    DbStateMessageComponent,
    OrdersTableComponent,
    MobileBarComponent,
    MobileContactCardComponent,
    MobileKpiGridComponent,
    MobileDockComponent,
    MobileSheetComponent,
  ],
  providers: [CurrencyArsPipe],
  templateUrl: './customer-detail.component.html',
  styleUrl: './customer-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerDetailComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly customersService = inject(CustomersService);
  private readonly ordersService = inject(OrdersService);
  private readonly settingsFacade = inject(SettingsFacade);
  private readonly formDialogs = inject(FormDialogService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly currencyArs = inject(CurrencyArsPipe);

  customer: Customer | null = null;
  orders: Order[] = [];
  loading = true;
  notFound = false;
  mobileActionsOpen = false;
  wholesaleDiscountPercent = 0;

  readonly typeLabel = customerTypeLabel;
  readonly sourceLabel = customerSourceLabel;

  get isRevendedor(): boolean {
    return this.customer?.type === CustomerType.REVENDEDOR;
  }

  ngOnInit(): void {
    this.settingsFacade.load();
    this.settingsFacade
      .watchUntilDestroyed(this.destroyRef)
      .subscribe((settings) => {
        if (!settings) return;
        this.wholesaleDiscountPercent =
          normalizeWholesaleDiscount(settings.wholesaleDiscount).percent;
        this.cdr.markForCheck();
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
        this.loadCustomer(id);
      });
  }

  ngOnDestroy(): void {
    this.closeMobileActions();
  }

  get activeOrders(): Order[] {
    return this.orders.filter((o) => isActiveOrder(o.status));
  }

  get finishedOrders(): Order[] {
    return this.orders.filter((o) => isFinishedOrder(o.status));
  }

  get totalSpent(): number {
    return this.finishedOrders.reduce((sum, order) => sum + order.total, 0);
  }

  get balanceAmount(): number {
    return this.orders.reduce((sum, order) => {
      if (!orderHasPendingBalance(order)) return sum;
      return sum + orderBalanceAmount(order);
    }, 0);
  }

  get balanceOrdersCount(): number {
    return this.orders.filter((order) => orderHasPendingBalance(order)).length;
  }

  get purchasedOrdersCount(): number {
    return this.finishedOrders.length;
  }

  get purchasedSinceLabel(): string {
    if (!this.customer?.createdAt) return '';
    const date = new Date(this.customer.createdAt);
    if (Number.isNaN(date.getTime())) return '';
    const month = date
      .toLocaleDateString('es-AR', { month: 'short' })
      .replace(/\./g, '')
      .trim()
      .toLowerCase();
    return month ? `desde ${month}` : '';
  }

  get purchasedKpiValue(): string {
    const money = this.currencyArs.transform(this.totalSpent);
    const count = this.purchasedOrdersCount;
    if (count <= 0) return money;
    return `${money} · ${count} entregados`;
  }

  get balanceKpiSub(): string {
    const count = this.balanceOrdersCount;
    if (count <= 0) return 'Sin saldo pendiente';
    return pluralize(count, 'pedido con saldo', 'pedidos con saldo');
  }

  get typePillLabel(): string {
    const type = customerTypeLabel(this.customer?.type);
    if (!this.isRevendedor || this.wholesaleDiscountPercent <= 0) {
      return type;
    }
    return `${type} · −${this.wholesaleDiscountPercent}%`;
  }

  get sourcePillLabel(): string {
    const source = customerSourceLabel(this.customer?.source);
    if (!source) return '';
    return `Llegó por ${source}`;
  }

  get whatsappHref(): string | null {
    const phone = this.customer?.phone?.trim();
    if (!phone) return null;
    const normalized = normalizeWhatsAppPhone(phone);
    return normalized ? `https://wa.me/${normalized}` : null;
  }

  get telHref(): string | null {
    const phone = this.customer?.phone?.trim();
    if (!phone) return null;
    const digits = phone.replace(/[^\d+]/g, '');
    return digits ? `tel:${digits}` : null;
  }

  get phoneDisplay(): string {
    return formatPhoneArDisplay(this.customer?.phone) || (this.customer?.phone ?? '');
  }

  get customerInitials(): string {
    return (this.customer?.name ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() ?? '')
      .join('');
  }

  get showContactActions(): boolean {
    return !!(this.whatsappHref || this.telHref);
  }

  get mobileContactPills(): MobileContactPill[] {
    const pills: MobileContactPill[] = [
      { label: this.typePillLabel, className: 'm-pill--b' },
    ];
    if (this.sourcePillLabel) {
      pills.push({ label: this.sourcePillLabel });
    }
    return pills;
  }

  get mobileKpiItems(): MobileKpiItem[] {
    return [
      {
        label: 'Comprado',
        value: this.purchasedKpiValue,
        hint: this.purchasedSinceLabel || null,
      },
      {
        label: 'Saldo',
        value: this.currencyArs.transform(this.balanceAmount),
        hint: this.balanceKpiSub,
        tone: this.balanceAmount > 0 ? 'danger' : 'default',
      },
    ];
  }

  loadCustomer(id: string): void {
    this.loading = true;
    this.notFound = false;
    this.cdr.markForCheck();

    forkJoin({
      customer: this.customersService.getCustomer(id),
      orders: this.ordersService.getOrders({ customerId: id }),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ customer, orders }) => {
          if (this.route.snapshot.paramMap.get('id') !== id) return;
          this.customer = customer;
          this.orders = orders;
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

  openEdit(): void {
    if (!this.customer) return;

    this.formDialogs.openCustomer(this.customer).subscribe((updated) => {
      if (updated) {
        this.customer = updated;
        this.cdr.markForCheck();
      }
    });
  }

  readonly mobileDockActions: MobileDockAction[] = [
    { id: 'quote', label: 'Presupuesto', kind: 'secondary' },
    { id: 'order', label: 'Nuevo pedido', kind: 'primary' },
  ];

  onMobileDockAction(id: string): void {
    if (id === 'quote') {
      this.addQuote();
      return;
    }
    if (id === 'order') {
      this.addOrder();
    }
  }

  addOrder(): void {
    if (!this.customer) return;

    this.formDialogs
      .openOrder(null, { presetCustomerId: this.customer.id })
      .subscribe((saved) => {
        if (saved) {
          this.orders = [saved, ...this.orders];
          this.cdr.markForCheck();
        }
      });
  }

  addQuote(): void {
    if (!this.customer) return;

    this.formDialogs
      .openQuote(null, { presetCustomerId: this.customer.id })
      .subscribe();
  }

  addSale(): void {
    this.closeMobileActions();
    this.formDialogs.openSale().subscribe();
  }

  deleteCustomer(): void {
    if (!this.customer) return;
    const customer = this.customer;
    this.closeMobileActions();
    this.formDialogs
      .openConfirm({
        title: 'Eliminar cliente',
        message: `¿Eliminar a "${customer.name}"?`,
        confirmLabel: 'Eliminar',
        confirmVariant: 'delete',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.customersService.deleteCustomer(customer.id).subscribe({
          next: () => this.router.navigate(['/clientes']),
          error: (err) => {
            this.formDialogs
              .openConfirm({
                title: 'No se pudo eliminar',
                message: extractApiErrorMessage(
                  err,
                  'No se pudo eliminar el cliente',
                ),
                confirmLabel: 'Entendido',
                alertOnly: true,
              })
              .subscribe();
          },
        });
      });
  }

  openMobileActions(): void {
    if (this.mobileActionsOpen) return;
    this.mobileActionsOpen = true;
    this.cdr.markForCheck();
  }

  closeMobileActions(): void {
    if (!this.mobileActionsOpen) return;
    this.mobileActionsOpen = false;
    this.cdr.markForCheck();
  }

  orderRowTitle(order: Order): string {
    const names = order.items
      .map((item) => item.productName?.trim())
      .filter((name): name is string => !!name);
    if (!names.length) return order.id;
    if (names.length === 1) {
      const qty = Number(order.items[0]?.quantity) || 0;
      if (qty > 1) return `${order.id} · ${qty} ${names[0]}`;
      return `${order.id} · ${names[0]}`;
    }
    return `${order.id} · ${names.slice(0, 2).join(' y ')}`;
  }

  orderRowMeta(order: Order): string {
    const status =
      ORDER_STATUS_LABELS[order.status as OrderStatus] ?? order.status;
    if (order.status === OrderStatus.ENTREGADO) {
      const delivered = formatDayMonth(order.dueDate);
      return delivered ? `${status} ${delivered}` : status;
    }
    if (isFinishedOrder(order.status) || order.status === OrderStatus.CANCELADO) {
      return status;
    }
    const overdue = orderIsOverdue(order.dueDate, order.status);
    const delivery = formatOrderMobileDeliveryLabel(order.dueDate, overdue)
      .replace(/^Entrega\s+/i, 'entrega ')
      .replace(/^Vencía\s+/i, 'vencía ');
    return delivery ? `${status} · ${delivery}` : status;
  }

  /** Saldo pendiente del pedido, o null si no hay. */
  orderRowBalance(order: Order): number | null {
    if (!orderHasPendingBalance(order)) return null;
    const balance = orderBalanceAmount(order);
    return balance > 0 ? balance : null;
  }
}

function normalizeWhatsAppPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('54')) return digits;
  if (digits.startsWith('0')) return `54${digits.slice(1)}`;
  return `54${digits}`;
}

function formatDayMonth(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getDate()}/${date.getMonth() + 1}`;
}
