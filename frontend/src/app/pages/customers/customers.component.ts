import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  ElementRef,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, NavigationStart, Router, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { filter } from 'rxjs/operators';
import { Customer, CustomerType, Order } from '../../core/models';
import { BreakpointService } from '../../core/services/breakpoint.service';
import { CustomerCatalogService } from '../../core/services/customer-catalog.service';
import { CustomersService } from '../../core/services/customers.service';
import { OrdersService } from '../../core/services/orders.service';
import { RealtimeCatalogSyncService } from '../../core/services/realtime-catalog-sync.service';
import { RealtimeService } from '../../core/services/realtime.service';
import { removeById, upsertById } from '../../core/utils/replace-in-store';
import { FormDialogService } from '../../shared/form-dialogs/public-api';
import {
  DB_DATA_TABLE,
  DbButtonComponent,
  DbSkeletonComponent,
  MobileBarComponent,
  OdlActionEvent,
  OdlBadge,
  OdlColumn,
  OdlFilter,
  OdlRowAction,
  OdlTone,
} from '@general-components';
import { extractApiErrorMessage } from '../../shared/utils/api-error';
import {
  clearCreateQuery,
  shouldOpenCreateFromQuery,
} from '../../shared/utils/create-from-query.util';
import {
  orderHasPendingBalance,
  orderBalanceAmount,
  pluralize,
} from '../../shared/utils/order.helpers';
import {
  customerTypeLabel,
  CUSTOMER_TYPE_LABELS,
} from '../../shared/utils/v1-labels.util';
import { CurrencyArsPipe } from '../../shared/pipes/labels.pipe';
import {
  CustomersMobileChip,
  CustomersMobileStateService,
} from './customers-mobile-state.service';

interface MobileListChip {
  value: CustomersMobileChip;
  label: string;
  count: number;
}

interface CustomerOrderStats {
  orderCount: number;
  balance: number;
}

@Component({
  selector: 'app-customers',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    DbButtonComponent,
    DbSkeletonComponent,
    MobileBarComponent,
    CurrencyArsPipe,
    ...DB_DATA_TABLE,
  ],
  templateUrl: './customers.component.html',
  styleUrl: './customers.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomersComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly customersService = inject(CustomersService);
  private readonly customerCatalog = inject(CustomerCatalogService);
  private readonly ordersService = inject(OrdersService);
  private readonly catalogSync = inject(RealtimeCatalogSyncService);
  private readonly realtime = inject(RealtimeService);
  private readonly formDialogs = inject(FormDialogService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly breakpoint = inject(BreakpointService);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly mobileState = inject(CustomersMobileStateService);

  customers: Customer[] = [];
  loading = true;
  search = '';
  mobileChip: CustomersMobileChip = 'all';

  private orderStatsByCustomer = new Map<string, CustomerOrderStats>();
  private pendingScrollY: number | null = null;
  private scrollActiveChipOnInit = false;

  readonly kindFilters: OdlFilter<Customer>[] = [
    { id: 'all', label: 'Todos' },
    {
      id: 'particular',
      label: 'Particulares',
      predicate: (customer) => customer.type === CustomerType.PARTICULAR,
    },
    {
      id: 'empresa',
      label: 'Empresas',
      predicate: (customer) => customer.type === CustomerType.EMPRESA,
    },
    {
      id: 'revendedor',
      label: 'Revendedores',
      predicate: (customer) => customer.type === CustomerType.REVENDEDOR,
    },
  ];

  readonly actions: OdlRowAction<Customer>[] = [
    { id: 'ver', label: 'Ver ficha' },
    { id: 'editar', label: 'Editar' },
    { id: 'eliminar', label: 'Eliminar', danger: true },
  ];

  readonly columns: OdlColumn<Customer>[] = [
    {
      key: 'name',
      header: 'Cliente',
      type: 'avatar',
      sortable: true,
      secondary: (customer) =>
        customer.company?.trim() || customerTypeLabel(customer.type) || null,
    },
    {
      key: 'type',
      header: 'Tipo',
      type: 'badge',
      badge: (customer) => customerTypeBadge(customer.type),
    },
    { key: 'email', header: 'Email' },
    { key: 'phone', header: 'Teléfono', value: (customer) => customer.phone || null },
    { key: 'createdAt', header: 'Cliente desde', type: 'date', sortable: true },
  ];

  ngOnInit(): void {
    this.restoreMobileState();
    this.loadCustomers();
    this.realtime.bindSmartReload(this.destroyRef, 'customers', (event) => {
      this.catalogSync.handleEvent(event);
      this.loadCustomers();
    });
    this.realtime.bindSmartReload(this.destroyRef, 'orders', () => {
      if (this.breakpoint.isMobile()) this.loadOrderStats();
    });

    this.router.events
      .pipe(
        filter(
          (event): event is NavigationStart => event instanceof NavigationStart,
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.persistMobileState());

    if (shouldOpenCreateFromQuery(this.route)) {
      this.openCreateCustomer();
      clearCreateQuery(this.router);
    }
  }

  ngAfterViewInit(): void {
    if (!this.scrollActiveChipOnInit) return;
    requestAnimationFrame(() => this.scrollActiveMobileChipIntoView());
  }

  ngOnDestroy(): void {
    this.persistMobileState({ keepScroll: true });
  }

  get revendedorCount(): number {
    return this.customers.filter(
      (customer) => customer.type === CustomerType.REVENDEDOR,
    ).length;
  }

  get mobileListChips(): MobileListChip[] {
    const counts = this.mobileChipCounts;
    return [
      { value: 'all', label: 'Todos', count: counts.all },
      { value: 'revendedor', label: 'Revendedores', count: counts.revendedor },
      { value: 'empresa', label: 'Empresas', count: counts.empresa },
      { value: 'con_saldo', label: 'Con saldo', count: counts.con_saldo },
    ];
  }

  get mobileChipCounts(): Record<CustomersMobileChip, number> {
    const counts: Record<CustomersMobileChip, number> = {
      all: this.customers.length,
      revendedor: 0,
      empresa: 0,
      con_saldo: 0,
    };
    for (const customer of this.customers) {
      if (customer.type === CustomerType.REVENDEDOR) counts.revendedor += 1;
      if (customer.type === CustomerType.EMPRESA) counts.empresa += 1;
      if ((this.orderStatsByCustomer.get(customer.id)?.balance ?? 0) > 0) {
        counts.con_saldo += 1;
      }
    }
    return counts;
  }

  get filteredMobileCustomers(): Customer[] {
    const term = this.search.trim().toLowerCase();
    return this.customers.filter((customer) => {
      if (!this.matchesMobileChip(customer)) return false;
      if (!term) return true;
      const haystack = [
        customer.name,
        customer.email,
        customer.phone,
        customer.company,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }

  onAction(event: OdlActionEvent<Customer>): void {
    if (event.actionId === 'ver') this.openCustomer(event.row);
    if (event.actionId === 'editar') this.openEditCustomer(event.row);
    if (event.actionId === 'eliminar') this.deleteCustomer(event.row);
  }

  openCustomer(customer: Customer): void {
    void this.router.navigate(['/clientes', customer.id]);
  }

  loadCustomers(): void {
    this.loading = true;
    this.cdr.markForCheck();
    // Siempre desde API para traer type / wholesaleMinimum (el cache de
    // reference-data a veces no los incluye).
    // Los pedidos solo hacen falta en mobile (saldo y cantidad por cliente).
    forkJoin({
      customers: this.customerCatalog.getCustomers(true),
      orders: this.breakpoint.isMobile()
        ? this.ordersService.getOrders()
        : of([] as Order[]),
    }).subscribe({
      next: ({ customers, orders }) => {
        this.customers = customers;
        this.orderStatsByCustomer = buildOrderStats(orders);
        this.loading = false;
        this.cdr.markForCheck();
        this.restoreScrollIfNeeded();
      },
      error: () => {
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  private loadOrderStats(): void {
    this.ordersService.getOrders().subscribe({
      next: (orders) => {
        this.orderStatsByCustomer = buildOrderStats(orders);
        this.cdr.markForCheck();
      },
    });
  }

  openCreateCustomer(): void {
    this.formDialogs.openCustomer().subscribe((saved) => {
      if (saved) this.onCustomerSaved(saved);
    });
  }

  openEditCustomer(customer: Customer): void {
    this.formDialogs.openCustomer(customer).subscribe((saved) => {
      if (saved) this.onCustomerSaved(saved);
    });
  }

  onCustomerSaved(saved: Customer): void {
    this.customers = upsertById(this.customers, saved);
    this.cdr.markForCheck();
  }

  deleteCustomer(customer: Customer): void {
    this.formDialogs
      .openConfirm({
        title: 'Eliminar cliente',
        message: `¿Eliminar a "${customer.name}"?`,
        confirmLabel: 'Eliminar',
        confirmVariant: 'delete',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        const previous = this.customers;
        this.customers = removeById(this.customers, customer.id);
        this.cdr.markForCheck();

        this.customersService.deleteCustomer(customer.id).subscribe({
          next: () => this.customerCatalog.remove(customer.id),
          error: (err) => {
            this.customers = previous;
            this.cdr.markForCheck();
            this.formDialogs
              .openConfirm({
                title: 'No se pudo eliminar',
                message: extractApiErrorMessage(err, 'No se pudo eliminar el cliente'),
                confirmLabel: 'Entendido',
                alertOnly: true,
              })
              .subscribe();
          },
        });
      });
  }

  setMobileChip(chip: CustomersMobileChip): void {
    this.mobileChip = chip;
    this.persistMobileState();
    this.cdr.markForCheck();
  }

  onSearchChange(): void {
    this.persistMobileState();
  }

  customerInitials(customer: Customer): string {
    return customer.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() ?? '')
      .join('');
  }

  customerSubtitle(customer: Customer): string {
    const type = customerTypeLabel(customer.type) || 'Cliente';
    if (
      customer.type === CustomerType.EMPRESA &&
      customer.company?.trim()
    ) {
      return `${type} · ${customer.company.trim()}`;
    }
    const count = this.orderStatsByCustomer.get(customer.id)?.orderCount ?? 0;
    if (count <= 0) return `${type} · sin pedidos`;
    return `${type} · ${pluralize(count, 'pedido', 'pedidos')}`;
  }

  customerBalance(customer: Customer): number {
    return this.orderStatsByCustomer.get(customer.id)?.balance ?? 0;
  }

  private matchesMobileChip(customer: Customer): boolean {
    switch (this.mobileChip) {
      case 'revendedor':
        return customer.type === CustomerType.REVENDEDOR;
      case 'empresa':
        return customer.type === CustomerType.EMPRESA;
      case 'con_saldo':
        return (this.orderStatsByCustomer.get(customer.id)?.balance ?? 0) > 0;
      case 'all':
      default:
        return true;
    }
  }

  private restoreMobileState(): void {
    const saved = this.mobileState.read();
    if (!saved) return;
    this.mobileChip = saved.chip;
    this.search = saved.search;
    if (saved.scrollY > 0) {
      this.pendingScrollY = saved.scrollY;
    }
    this.scrollActiveChipOnInit = true;
  }

  private persistMobileState(options: { keepScroll?: boolean } = {}): void {
    if (!this.breakpoint.isMobile()) return;
    const scrollY = options.keepScroll
      ? (this.mobileState.read()?.scrollY ?? 0)
      : window.scrollY;
    this.mobileState.save({
      chip: this.mobileChip,
      search: this.search,
      scrollY,
    });
  }

  private restoreScrollIfNeeded(): void {
    const y = this.pendingScrollY;
    if (y == null || y <= 0) return;
    this.pendingScrollY = null;
    requestAnimationFrame(() => {
      window.scrollTo(0, y);
    });
  }

  private scrollActiveMobileChipIntoView(): void {
    const chip = this.host.nativeElement.querySelector(
      '.m-chip.m-chip--on',
    ) as HTMLElement | null;
    chip?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  }
}

function customerTypeBadge(
  type: CustomerType | string | null | undefined,
): OdlBadge | null {
  if (!type || !(type in CUSTOMER_TYPE_LABELS)) return null;
  const label = CUSTOMER_TYPE_LABELS[type as CustomerType];
  const tone: OdlTone =
    type === CustomerType.REVENDEDOR
      ? 'info'
      : type === CustomerType.EMPRESA
        ? 'pending'
        : 'neutral';
  return { label, tone };
}

function buildOrderStats(orders: Order[]): Map<string, CustomerOrderStats> {
  const map = new Map<string, CustomerOrderStats>();
  for (const order of orders) {
    const customerId = order.customerId?.trim();
    if (!customerId) continue;
    const current = map.get(customerId) ?? { orderCount: 0, balance: 0 };
    current.orderCount += 1;
    if (orderHasPendingBalance(order)) {
      current.balance += orderBalanceAmount(order);
    }
    map.set(customerId, current);
  }
  for (const stats of map.values()) {
    stats.balance = Math.round(stats.balance * 100) / 100;
  }
  return map;
}
