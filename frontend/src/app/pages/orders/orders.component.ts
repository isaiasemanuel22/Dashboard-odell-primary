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
import { ActivatedRoute, NavigationStart, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { Order, OrderStatus, ServiceType } from '../../core/models';
import { RealtimeEvent } from '../../core/models/realtime.model';
import { BreakpointService } from '../../core/services/breakpoint.service';
import { OrdersService } from '../../core/services/orders.service';
import { RealtimeCatalogSyncService } from '../../core/services/realtime-catalog-sync.service';
import { RealtimeService } from '../../core/services/realtime.service';
import { removeById } from '../../core/utils/replace-in-store';
import { FormDialogService } from '../../shared/form-dialogs/public-api';
import {
  DbSkeletonComponent,
  DbStateMessageComponent,
  DbButtonComponent,
  OrderCardComponent,
  MobileBarComponent,
  isOrderOverdue,
} from '@general-components';
import { OrderMobileCardComponent } from '../../components/order-mobile-card/order-mobile-card.component';
import { extractApiErrorMessage } from '../../shared/utils/api-error';
import { plainTextFromHtml } from '../../shared/utils/rich-text.util';
import {
  clearCreateQuery,
  shouldOpenCreateFromQuery,
} from '../../shared/utils/create-from-query.util';
import {
  OrderMobileChip,
  OrderMobileSheetFilters,
  OrderServiceFilter,
  OrderStatusFilter,
  cancelOrderConfirmMessage,
  countOrderMobileSheetFilters,
  emptyOrderMobileSheetFilters,
  isClosedOrder,
  matchesOrderMobileChip,
  matchesOrderMobileSheetFilters,
  orderServiceFilters,
  orderStatusFilters,
} from '../../shared/utils/order.helpers';
import { OrdersMobileStateService } from './orders-mobile-state.service';

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [
    FormsModule,
    DbSkeletonComponent,
    DbStateMessageComponent,
    DbButtonComponent,
    OrderCardComponent,
    MobileBarComponent,
    OrderMobileCardComponent,
  ],
  templateUrl: './orders.component.html',
  styleUrl: './orders.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrdersComponent implements OnInit, AfterViewInit, OnDestroy {
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
  private readonly mobileState = inject(OrdersMobileStateService);

  orders: Order[] = [];
  loading = true;
  search = '';
  statusFilter: OrderStatusFilter = 'abiertos';
  serviceFilter: OrderServiceFilter = 'all';
  /** Activo con ?filtro=atrasados (filtro client-side sobre el listado). */
  overdueOnly = false;

  /** Chip activo de la lista mobile (estado separado del desktop). */
  mobileChip: OrderMobileChip = 'abiertos';
  mobileSheetFilters: OrderMobileSheetFilters = emptyOrderMobileSheetFilters();

  /** Scroll del chip activo al entrar con ?estado= / ?filtro=. */
  private scrollActiveChipOnInit = false;
  /** Scroll de la lista al volver del detalle (mobile). */
  private pendingScrollY: number | null = null;

  readonly statusFilters = orderStatusFilters();
  readonly serviceFilters = orderServiceFilters();

  readonly mobileChips: { value: OrderMobileChip; label: string }[] = [
    { value: 'abiertos', label: 'Abiertos' },
    { value: 'atrasados', label: 'Atrasados' },
    { value: 'para_entregar', label: 'Para entregar' },
    { value: 'con_saldo', label: 'Con saldo' },
    { value: 'todos', label: 'Todos' },
  ];

  ngOnInit(): void {
    const queryApplied = this.applyMobileQueryParams();
    if (!queryApplied) {
      this.restoreMobileState();
    }

    this.loadOrders();
    this.realtime.bindSmartReload(
      this.destroyRef,
      ['orders', 'customers', 'products'],
      (event) => this.handleRealtime(event),
    );

    this.router.events
      .pipe(
        filter((event): event is NavigationStart => event instanceof NavigationStart),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.persistMobileState());

    if (shouldOpenCreateFromQuery(this.route)) {
      this.openCreateOrder();
      clearCreateQuery(this.router);
    }
  }

  ngAfterViewInit(): void {
    if (!this.scrollActiveChipOnInit) return;
    // Dejar que el layout mobile pinte los chips antes de scrollear.
    requestAnimationFrame(() => this.scrollActiveMobileChipIntoView());
  }

  ngOnDestroy(): void {
    // Sin scroll: al destruirse la página ya está arriba y pisaría el guardado
    // en NavigationStart.
    this.persistMobileState({ keepScroll: true });
  }

  private applyMobileQueryParams(): boolean {
    if (this.route.snapshot.queryParamMap.get('filtro') === 'atrasados') {
      this.overdueOnly = true;
      this.statusFilter = 'abiertos';
      this.mobileChip = 'atrasados';
      this.scrollActiveChipOnInit = true;
      return true;
    }

    const estado = this.route.snapshot.queryParamMap.get('estado');
    if (
      estado &&
      (Object.values(OrderStatus) as string[]).includes(estado)
    ) {
      this.statusFilter = estado as OrderStatus;
      this.mobileChip = 'todos';
      this.mobileSheetFilters = {
        ...emptyOrderMobileSheetFilters(),
        statuses: [estado as OrderStatus],
      };
      this.scrollActiveChipOnInit = true;
      return true;
    }

    return false;
  }

  private restoreMobileState(): void {
    const saved = this.mobileState.read();
    if (!saved) return;
    this.mobileChip = saved.chip;
    this.mobileSheetFilters = saved.sheetFilters;
    this.search = saved.search;
    if (saved.scrollY > 0) {
      this.pendingScrollY = saved.scrollY;
    }
  }

  private persistMobileState(options: { keepScroll?: boolean } = {}): void {
    if (!this.breakpoint.isMobile()) return;
    const scrollY = options.keepScroll
      ? (this.mobileState.read()?.scrollY ?? 0)
      : window.scrollY;
    this.mobileState.save({
      chip: this.mobileChip,
      sheetFilters: this.mobileSheetFilters,
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

  get filteredOrders(): Order[] {
    const term = this.search.trim().toLowerCase();
    let list = !term
      ? [...this.orders]
      : this.orders.filter((order) =>
          [
            order.id,
            order.customerName,
            plainTextFromHtml(order.description),
            order.notes ?? '',
            ...order.items.map((item) => item.productName),
          ]
            .join(' ')
            .toLowerCase()
            .includes(term),
        );
    if (this.overdueOnly) {
      list = list.filter((order) =>
        isOrderOverdue(order.dueDate, order.status),
      );
    }
    return list.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  get mobileFilteredOrders(): Order[] {
    return this.applyMobileFilters(this.orders, this.mobileSheetFilters).sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  /** Lista para el contador de la hoja: chip + búsqueda (sin filtros de hoja). */
  get mobileOrdersForSheet(): Order[] {
    return this.applyMobileFilters(this.orders, emptyOrderMobileSheetFilters());
  }

  get openOrdersCount(): number {
    return this.orders.filter((order) => !isClosedOrder(order.status)).length;
  }

  get mobileSheetFilterCount(): number {
    return countOrderMobileSheetFilters(this.mobileSheetFilters);
  }

  get filtersButtonLabel(): string {
    const n = this.mobileSheetFilterCount;
    return n > 0 ? `Filtros · ${n}` : 'Filtros';
  }

  get hasActiveMobileSearchOrFilters(): boolean {
    return this.search.trim().length > 0 || this.mobileSheetFilterCount > 0;
  }

  get emptyMessage(): string {
    if (this.search.trim()) {
      return 'No hay pedidos que coincidan con los filtros.';
    }
    if (this.overdueOnly) {
      return 'No hay pedidos atrasados.';
    }
    if (this.statusFilter === 'abiertos') {
      return 'No hay pedidos abiertos.';
    }
    if (this.statusFilter !== 'all' || this.serviceFilter !== 'all') {
      return 'No hay pedidos que coincidan con los filtros.';
    }
    return 'No hay pedidos registrados.';
  }

  get mobileEmptyMessage(): string {
    if (this.search.trim() || this.mobileSheetFilterCount > 0) {
      return 'No hay pedidos que coincidan con los filtros.';
    }
    if (this.mobileChip === 'atrasados') {
      return 'No hay pedidos atrasados.';
    }
    if (this.mobileChip === 'abiertos') {
      return 'No hay pedidos abiertos.';
    }
    if (this.mobileChip === 'para_entregar') {
      return 'No hay pedidos para entregar.';
    }
    if (this.mobileChip === 'con_saldo') {
      return 'No hay pedidos con saldo pendiente.';
    }
    return 'No hay pedidos registrados.';
  }

  get mobileEmptyActionLabel(): string {
    if (this.hasActiveMobileSearchOrFilters) {
      return 'Limpiar búsqueda y filtros';
    }
    return this.orders.length ? 'Nuevo pedido' : 'Crear primer pedido';
  }

  get mobileChipCounts(): Record<OrderMobileChip, number> {
    const counts: Record<OrderMobileChip, number> = {
      abiertos: 0,
      atrasados: 0,
      para_entregar: 0,
      con_saldo: 0,
      todos: this.orders.length,
    };
    for (const order of this.orders) {
      if (!isClosedOrder(order.status)) counts.abiertos += 1;
      if (matchesOrderMobileChip(order, 'atrasados')) counts.atrasados += 1;
      if (matchesOrderMobileChip(order, 'para_entregar')) {
        counts.para_entregar += 1;
      }
      if (matchesOrderMobileChip(order, 'con_saldo')) counts.con_saldo += 1;
    }
    return counts;
  }

  onSearchChange(): void {
    this.cdr.markForCheck();
  }

  setStatusFilter(filter: OrderStatusFilter): void {
    this.statusFilter = filter;
    if (this.overdueOnly) {
      this.overdueOnly = false;
    }
    this.loadOrders();
  }

  setServiceFilter(filter: OrderServiceFilter): void {
    this.serviceFilter = filter;
    this.loadOrders();
  }

  setMobileChip(chip: OrderMobileChip): void {
    this.mobileChip = chip;
    this.cdr.markForCheck();
  }

  openMobileFilters(): void {
    this.formDialogs
      .openOrderFilters({
        filters: this.mobileSheetFilters,
        orders: this.mobileOrdersForSheet,
      })
      .subscribe((next) => {
        if (!next) return;
        this.mobileSheetFilters = next;
        this.cdr.markForCheck();
      });
  }

  onMobileEmptyAction(): void {
    if (this.hasActiveMobileSearchOrFilters) {
      this.clearMobileSearchAndFilters();
      return;
    }
    this.openCreateOrder();
  }

  clearMobileSearchAndFilters(): void {
    this.search = '';
    this.mobileChip = 'abiertos';
    this.mobileSheetFilters = emptyOrderMobileSheetFilters();
    this.cdr.markForCheck();
  }

  loadOrders(): void {
    this.loading = true;
    this.cdr.markForCheck();
    this.ordersService.getOrders(this.buildQuery()).subscribe({
      next: (orders) => {
        this.orders = orders;
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

  openCreateOrder(): void {
    this.formDialogs.openOrder().subscribe((saved) => {
      if (saved) this.onOrderSaved(saved);
    });
  }

  openEditOrder(order: Order): void {
    this.formDialogs.openOrder(order).subscribe((saved) => {
      if (saved) this.onOrderSaved(saved);
    });
  }

  onOrderSaved(_saved: Order): void {
    // Reaplica filtros activos (estado/área): la fila nueva no debe verse si no calza.
    this.loadOrders();
  }

  deleteOrder(order: Order): void {
    this.formDialogs
      .openConfirm({
        title: 'Cancelar pedido',
        message: cancelOrderConfirmMessage(order),
        confirmLabel: 'Cancelar pedido',
        cancelLabel: 'Volver',
        confirmVariant: 'delete',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        const previous = this.orders;
        this.orders = removeById(this.orders, order.id);
        this.cdr.markForCheck();

        this.ordersService.deleteOrder(order.id).subscribe({
          error: (err) => {
            this.orders = previous;
            this.cdr.markForCheck();
            this.formDialogs
              .openConfirm({
                title: 'No se pudo cancelar',
                message: extractApiErrorMessage(err, 'No se pudo cancelar el pedido'),
                confirmLabel: 'Entendido',
                alertOnly: true,
              })
              .subscribe();
          },
        });
      });
  }

  private handleRealtime(event: RealtimeEvent): void {
    this.catalogSync.handleEvent(event);
    this.loadOrders();
  }

  private applyMobileFilters(
    source: Order[],
    sheet: OrderMobileSheetFilters,
  ): Order[] {
    const term = this.search.trim().toLowerCase();
    return source.filter((order) => {
      if (!matchesOrderMobileChip(order, this.mobileChip)) return false;
      if (!matchesOrderMobileSheetFilters(order, sheet)) return false;
      if (!term) return true;
      return [
        order.id,
        order.customerName,
        plainTextFromHtml(order.description),
        order.notes ?? '',
        ...order.items.map((item) => item.productName),
      ]
        .join(' ')
        .toLowerCase()
        .includes(term);
    });
  }

  private buildQuery() {
    // Mobile filtra en cliente: hay que traer el listado completo («Todos»).
    if (this.breakpoint.isMobile()) {
      return {};
    }

    const query: {
      openOnly?: boolean;
      status?: OrderStatus;
      service?: ServiceType;
    } = {};

    if (this.statusFilter === 'abiertos') {
      query.openOnly = true;
    } else if (this.statusFilter !== 'all') {
      query.status = this.statusFilter;
    }

    if (this.serviceFilter !== 'all') {
      query.service = this.serviceFilter;
    }

    return query;
  }
}
