import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Order, OrderStatus, ServiceType } from '../../core/models';
import { RealtimeEvent } from '../../core/models/realtime.model';
import { BreakpointService } from '../../core/services/breakpoint.service';
import {
  MOBILE_LIST_KEYS,
  injectMobileListPersistence,
} from '../../core/services/mobile-list-state.service';
import { OrdersService } from '../../core/services/orders.service';
import { RealtimeCatalogSyncService } from '../../core/services/realtime-catalog-sync.service';
import { RealtimeService } from '../../core/services/realtime.service';
import { removeById } from '../../core/utils/replace-in-store';
import { FormDialogService } from '../../modals/public-api';
import {
  DbSkeletonComponent,
  DbStateMessageComponent,
  DbButtonComponent,
  OrderCardComponent,
  MobileBarComponent,
  MobileListToolbarComponent,
  type MobileListToolbarChip,
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

interface OrdersMobileListState {
  chip: OrderMobileChip;
  sheetFilters: OrderMobileSheetFilters;
  search: string;
  scrollY: number;
}

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
    MobileListToolbarComponent,
    OrderMobileCardComponent,
  ],
  templateUrl: './orders.component.html',
  styleUrl: './orders.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrdersComponent implements OnInit {
  private readonly ordersService = inject(OrdersService);
  private readonly catalogSync = inject(RealtimeCatalogSyncService);
  private readonly realtime = inject(RealtimeService);
  private readonly formDialogs = inject(FormDialogService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly breakpoint = inject(BreakpointService);
  private readonly listPersistence =
    injectMobileListPersistence<OrdersMobileListState>(MOBILE_LIST_KEYS.orders);

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
    this.listPersistence.connect(() => ({
      chip: this.mobileChip,
      sheetFilters: this.mobileSheetFilters,
      search: this.search,
    }));

    const queryApplied = this.applyMobileQueryParams();
    if (!queryApplied) {
      this.listPersistence.restore((saved) => {
        this.mobileChip = saved.chip;
        this.mobileSheetFilters = saved.sheetFilters;
        this.search = saved.search;
      });
    }

    this.loadOrders();
    this.realtime.bindSmartReload(
      this.destroyRef,
      ['orders', 'customers', 'products'],
      (event) => this.handleRealtime(event),
    );

    if (shouldOpenCreateFromQuery(this.route)) {
      this.openCreateOrder();
      clearCreateQuery(this.router);
    }
  }

  private applyMobileQueryParams(): boolean {
    if (this.route.snapshot.queryParamMap.get('filtro') === 'atrasados') {
      this.overdueOnly = true;
      this.statusFilter = 'abiertos';
      this.mobileChip = 'atrasados';
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
      return true;
    }

    return false;
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

  /** «2 de 6 abiertos» cuando hay filtros/búsqueda; si no, «N abiertos». */
  get openOrdersBarLabel(): string {
    const totalOpen = this.openOrdersCount;
    if (!this.hasActiveMobileSearchOrFilters) {
      return `${totalOpen} abiertos`;
    }
    const visibleOpen = this.mobileFilteredOrders.filter(
      (order) => !isClosedOrder(order.status),
    ).length;
    return `${visibleOpen} de ${totalOpen} abiertos`;
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

  get mobileToolbarChips(): MobileListToolbarChip[] {
    const counts = this.mobileChipCounts;
    return this.mobileChips.map((chip) => ({
      id: chip.value,
      label: chip.label,
      count: chip.value === 'todos' ? undefined : counts[chip.value],
    }));
  }

  onSearchChange(): void {
    this.cdr.markForCheck();
  }

  onMobileChipChange(chipId: string): void {
    this.mobileChip = chipId as OrderMobileChip;
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
        this.listPersistence.onListReady();
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
