import { Observable, Subscription } from 'rxjs';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  AreaProfitBalance,
  SaleEntry,
  SaleSource,
  SalesStats,
  ServiceType,
} from '../../core/models';
import { RealtimeService } from '../../core/services/realtime.service';
import { BreakpointService } from '../../core/services/breakpoint.service';
import { SalesService } from '../../core/services/sales.service';
import { OrdersService } from '../../core/services/orders.service';
import { SettingsFacade } from '../../store/settings/settings.facade';
import { FormDialogService } from '../../modals/public-api';
import {
  DB_DATA_TABLE,
  DbStateMessageComponent,
  DbButtonComponent,
  MobileBarComponent,
  MobileKpiGridComponent,
  MobilePeriodPickerComponent,
  OdlActionEvent,
  OdlColumn,
  OdlFilter,
  OdlRowAction,
  SalesStatsGridComponent,
  serviceTag,
  type MobileKpiItem,
} from '@general-components';
import {
  AreaServiceType,
  SERVICE_TYPE_LABELS,
} from '../../shared/constants/labels';
import { extractApiErrorMessage } from '../../shared/utils/api-error';
import { formatDateDayMonth } from '../../shared/utils/date-format.util';
import { pluralize } from '../../shared/utils/order.helpers';
import { downloadSalesReportPdf } from '../../shared/utils/sales-report.util';
import { salesChannelLabel } from '../../shared/utils/v1-labels.util';
import { downloadAccountantExport } from '../../shared/utils/sales-accountant-export.util';
import { annualCapPercentLabel, uninvoicedDetail } from '../../shared/utils/sales-invoice.util';
import { formatCurrencyArs } from '../../shared/utils/currency-ars.util';
import { CurrencyArsPipe } from '../../shared/pipes/labels.pipe';
import { ProductsService } from '../../core/services/products.service';
import {
  SaleMobileSheetFilters,
  countSaleMobileSheetFilters,
  emptySaleMobileSheetFilters,
  matchesSaleSheetFilters,
} from '../../modals/sale-filters-sheet.component';

/** Chips de la tabla: Todas, canales presentes y «Sin facturar · N». */
function buildChannelFilters(entries: SaleEntry[]): OdlFilter<SaleEntry>[] {
  const channels = [...new Set(entries.map((entry) => entry.channel))];
  const uninvoiced = entries.filter((entry) => !entry.invoice).length;
  return [
    { id: 'all', label: 'Todas' },
    ...channels.map((channel) => ({
      id: channel,
      label: salesChannelLabel(channel) || 'Sin canal',
      predicate: (entry: SaleEntry) => entry.channel === channel,
    })),
    {
      id: 'sin_facturar',
      label: `Sin facturar · ${uninvoiced}`,
      predicate: (entry: SaleEntry) => !entry.invoice,
    },
  ];
}

const SALE_AREAS: AreaServiceType[] = [
  ServiceType.IMPRESION_3D,
  ServiceType.DISENO_GRAFICO,
  ServiceType.MODELADO,
  ServiceType.ESTAMPADO,
];

@Component({
  selector: 'app-sales',
  standalone: true,
  imports: [
    DbStateMessageComponent,
    DbButtonComponent,
    MobileBarComponent,
    MobileKpiGridComponent,
    MobilePeriodPickerComponent,
    SalesStatsGridComponent,
    CurrencyArsPipe,
    ...DB_DATA_TABLE,
  ],
  templateUrl: './sales.component.html',
  styleUrl: './sales.component.scss',
  providers: [CurrencyArsPipe],
})
export class SalesComponent implements OnInit {
  private readonly salesService = inject(SalesService);
  private readonly ordersService = inject(OrdersService);
  private readonly settingsFacade = inject(SettingsFacade);
  private readonly productsService = inject(ProductsService);
  private readonly realtime = inject(RealtimeService);
  private readonly formDialogs = inject(FormDialogService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly breakpoint = inject(BreakpointService);
  private readonly currencyArs = inject(CurrencyArsPipe);

  loading = true;
  loadError = false;
  reportMessage = '';
  stats: SalesStats | null = null;
  entries: SaleEntry[] = [];
  mobileSheetFilters: SaleMobileSheetFilters = emptySaleMobileSheetFilters();
  private viewMonth = new Date();
  private pointOfSale: number | null = null;
  /** Chips de canal: solo los presentes en el mes + «Sin facturar · N». */
  channelFilters: OdlFilter<SaleEntry>[] = buildChannelFilters([]);

  get monthLabel(): string {
    return this.viewMonth
      .toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
      .replace(' de ', ' ');
  }

  /** Mes con inicial mayúscula para la barra mobile. */
  get monthLabelDisplay(): string {
    const label = this.monthLabel;
    return label ? label.charAt(0).toUpperCase() + label.slice(1) : label;
  }

  get monthName(): string {
    return this.viewMonth.toLocaleDateString('es-AR', { month: 'long' });
  }

  get salesCountLabel(): string {
    return pluralize(this.mobileFilteredEntries.length, 'venta', 'ventas');
  }

  /** Lista mobile con los mismos predicados que filters/areaFilters desktop. */
  get mobileFilteredEntries(): SaleEntry[] {
    return this.entries.filter((entry) =>
      matchesSaleSheetFilters(entry, this.mobileSheetFilters),
    );
  }

  get mobileSheetFilterCount(): number {
    return countSaleMobileSheetFilters(this.mobileSheetFilters);
  }

  get filtersButtonLabel(): string {
    const n = this.mobileSheetFilterCount;
    return n > 0 ? `Filtros (${n})` : 'Filtros';
  }

  openMobileFilters(): void {
    this.formDialogs
      .openSaleFilters({
        filters: this.mobileSheetFilters,
        entries: this.entries,
      })
      .subscribe((next) => {
        if (!next) return;
        this.mobileSheetFilters = next;
      });
  }

  clearMobileFilters(): void {
    this.mobileSheetFilters = emptySaleMobileSheetFilters();
  }

  get mobileKpiItems(): MobileKpiItem[] {
    if (!this.stats) return [];
    return [
      {
        label: 'Vendido',
        value: this.currencyArs.transform(this.stats.monthlyRevenue),
        hint: this.salesCountLabel,
      },
      {
        label: 'Ganancia neta',
        value: this.currencyArs.transform(this.stats.monthlyNetProfit),
        hint: `Costo ${this.currencyArs.transform(this.stats.monthlyCost)}`,
        tone: this.stats.monthlyNetProfit >= 0 ? 'success' : 'danger',
      },
      {
        label: 'Facturado',
        value: this.currencyArs.transform(this.stats.invoicedRevenue),
        hint: uninvoicedDetail(this.stats),
      },
      {
        label: 'Últimos 12 meses',
        value: this.currencyArs.transform(this.stats.last12MonthsInvoicedRevenue),
        hint: this.stats.annualInvoiceCap
          ? `${annualCapPercentLabel(this.stats)} % del tope de ${formatCurrencyArs(this.stats.annualInvoiceCap)}`
          : 'Sin tope cargado',
      },
    ];
  }

  get mobileAreas(): AreaProfitBalance[] {
    return (this.stats?.profitByArea ?? []).filter((area) => area.revenue > 0);
  }

  readonly searchText = (entry: SaleEntry) =>
    [
      entry.saleId,
      entry.customerName ?? '',
      entry.notes ?? '',
      entry.orderId ?? '',
      ...entry.items.map((item) => `${item.productName} ${item.quantity}`),
    ].join(' ');

  readonly areaFilters: OdlFilter<SaleEntry>[] = [
    { id: 'all', label: 'Todas' },
    ...SALE_AREAS.map((area) => ({
      id: area,
      label: SERVICE_TYPE_LABELS[area],
      predicate: (entry: SaleEntry) => entry.items.some((item) => item.serviceType === area),
    })),
  ];

  readonly actions: OdlRowAction<SaleEntry>[] = [
    { id: 'editar', label: 'Editar', hidden: (entry) => !entry.editable },
    { id: 'eliminar', label: 'Eliminar', danger: true, hidden: (entry) => !entry.editable },
    { id: 'ver', label: 'Ver pedido', hidden: (entry) => entry.editable || !entry.orderId },
    { id: 'facturar', label: 'Marcar facturada', hidden: (entry) => !!entry.invoice },
    { id: 'quitar-factura', label: 'Quitar factura', hidden: (entry) => !entry.invoice },
  ];

  readonly columns: OdlColumn<SaleEntry>[] = [
    { key: 'saleId', header: 'Venta', type: 'primary' },
    { key: 'customerName', header: 'Cliente', value: (entry) => entry.customerName || 'Sin cliente' },
    {
      key: 'channel',
      header: 'Canal',
      type: 'badge',
      badge: (entry) => ({
        label: salesChannelLabel(entry.channel) || 'Sin canal',
        tone: entry.channel === 'sin_canal' ? 'neutral' : 'info',
      }),
    },
    {
      key: 'areas',
      header: 'Áreas',
      type: 'tags',
      tags: (entry) => {
        const seen = new Set<ServiceType>();
        return entry.items.flatMap((item) => {
          if (!item.serviceType || seen.has(item.serviceType)) return [];
          seen.add(item.serviceType);
          return [serviceTag(item.serviceType)];
        });
      },
    },
    { key: 'soldAt', header: 'Fecha', type: 'date' },
    { key: 'cost', header: 'Costo', type: 'money' },
    { key: 'netProfit', header: 'Ganancia neta', type: 'signedMoney' },
    { key: 'total', header: 'Total', type: 'money' },
    { key: 'invoice', header: 'Factura', type: 'custom' },
  ];

  get emptyText(): string {
    return `No hay ventas registradas en ${this.monthName}.`;
  }

  ngOnInit(): void {
    this.settingsFacade.ensureLoaded().subscribe({
      next: (settings) => {
        this.pointOfSale = settings.integrations?.arca?.pointOfSale ?? null;
      },
      error: () => undefined,
    });
    this.loadData();
    this.realtime.bindReload(this.destroyRef, ['sales', 'orders'], () =>
      this.loadData(),
    );
  }

  openCreateSale(): void {
    if (this.breakpoint.isMobile()) {
      void this.router.navigate(['/ventas/nueva']);
      return;
    }
    this.formDialogs.openSale().subscribe((saved) => {
      if (saved) this.onSaleSaved();
    });
  }

  openMobileEntry(entry: SaleEntry): void {
    if (entry.editable) {
      this.openEditSale(entry);
      return;
    }
    if (entry.orderId) {
      void this.router.navigate(['/pedidos', entry.orderId]);
    }
  }

  areaLabel(area: AreaProfitBalance['area']): string {
    return area === 'sin_area' ? 'Sin área' : SERVICE_TYPE_LABELS[area];
  }

  areaSourceLabel(area: AreaProfitBalance): string {
    const parts: string[] = [];
    if (area.retail.revenue > 0) {
      parts.push(`Mostrador ${this.formatMoney(area.retail.revenue)}`);
    }
    if (area.orders.revenue > 0) {
      parts.push(`pedidos ${this.formatMoney(area.orders.revenue)}`);
    }
    if (!parts.length) return '';
    if (parts.length === 1 && area.orders.revenue > 0 && area.retail.revenue <= 0) {
      return `Pedidos ${this.formatMoney(area.orders.revenue)}`;
    }
    return parts.join(' · ');
  }

  entryAvatar(entry: SaleEntry): string {
    if (entry.source === SaleSource.RETAIL) return 'M';
    return this.initials(entry.customerName || entry.saleId);
  }

  entryTitle(entry: SaleEntry): string {
    if (entry.source === SaleSource.RETAIL) {
      const note = entry.notes?.trim();
      if (note) return `Mostrador · ${note}`;
      const count = entry.items.reduce((sum, item) => sum + item.quantity, 0);
      return `Mostrador · ${pluralize(count, 'producto', 'productos')}`;
    }
    const customer = entry.customerName?.trim();
    return customer ? `${entry.saleId} · ${customer}` : entry.saleId;
  }

  entryMeta(entry: SaleEntry): string {
    const day = formatDateDayMonth(entry.soldAt);
    const channel = salesChannelLabel(entry.channel) || 'Sin canal';
    if (entry.source === SaleSource.RETAIL) {
      const count = entry.items.reduce((sum, item) => sum + item.quantity, 0);
      const editable = entry.editable ? ' · editable' : '';
      return `${day} · ${channel} · ${pluralize(count, 'producto', 'productos')}${editable}`;
    }
    return `Entregado ${day} · ${channel}`;
  }

  toggleInvoice(entry: SaleEntry): void {
    if (entry.invoice) this.removeInvoice(entry);
    else this.markInvoice(entry);
  }

  onAction(event: OdlActionEvent<SaleEntry>): void {
    if (event.actionId === 'editar') this.openEditSale(event.row);
    if (event.actionId === 'eliminar') this.deleteSale(event.row);
    if (event.actionId === 'facturar') this.markInvoice(event.row);
    if (event.actionId === 'quitar-factura') this.removeInvoice(event.row);
    if (event.actionId === 'ver' && event.row.orderId) {
      void this.router.navigate(['/pedidos', event.row.orderId]);
    }
  }

  markInvoice(entry: SaleEntry): void {
    this.formDialogs
      .openInvoiceMark({ saleLabel: entry.saleId, pointOfSale: this.pointOfSale })
      .subscribe((result) => {
        if (!result) return;
        const request = entry.retailSaleId
          ? this.salesService.markRetailInvoice(entry.retailSaleId, result)
          : entry.orderId
            ? this.ordersService.markInvoice(entry.orderId, result)
            : null;
        this.runInvoiceRequest(request, 'No se pudo marcar la factura');
      });
  }

  removeInvoice(entry: SaleEntry): void {
    if (!entry.invoice) return;
    this.formDialogs
      .openConfirm({
        title: 'Quitar factura',
        message: `¿Quitar la factura ${entry.invoice.number} de ${entry.saleId}? Solo se desmarca en Odell.`,
        confirmLabel: 'Quitar factura',
        confirmVariant: 'delete',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        const request = entry.retailSaleId
          ? this.salesService.removeRetailInvoice(entry.retailSaleId)
          : entry.orderId
            ? this.ordersService.removeInvoice(entry.orderId)
            : null;
        this.runInvoiceRequest(request, 'No se pudo quitar la factura');
      });
  }

  private runInvoiceRequest(
    request: Observable<unknown> | null,
    fallback: string,
  ): void {
    if (!request) return;
    request.subscribe({
      next: () => this.loadData(),
      error: (err) => {
        this.reportMessage = extractApiErrorMessage(err, fallback);
      },
    });
  }

  exportForAccountant(): void {
    if (this.loading || !this.entries.length) {
      this.reportMessage = 'No hay ventas en el mes para exportar.';
      return;
    }
    const month = this.monthParam();
    const label = this.monthLabel;
    downloadAccountantExport(this.entries, month)
      .then(() => {
        this.reportMessage = `Listo: se descargó la planilla de ${label} para el contador.`;
      })
      .catch((err) => {
        this.reportMessage = extractApiErrorMessage(err, 'No se pudo generar la planilla');
      });
  }

  invoiceLabel(entry: SaleEntry): string {
    return entry.invoice ? `${entry.invoice.type} ${entry.invoice.number}` : '';
  }

  private initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  }

  private formatMoney(value: number): string {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0,
    }).format(value);
  }

  openEditSale(entry: SaleEntry): void {
    if (!entry.retailSaleId) return;

    if (this.breakpoint.isMobile()) {
      void this.router.navigate(['/ventas', entry.retailSaleId, 'editar']);
      return;
    }

    this.salesService.getRetailSale(entry.retailSaleId).subscribe({
      next: (sale) => {
        this.formDialogs.openSale(sale).subscribe((saved) => {
          if (saved) this.onSaleSaved();
        });
      },
      error: (err) => {
        this.reportMessage = extractApiErrorMessage(err, 'No se pudo cargar la venta');
      },
    });
  }

  onSaleSaved(): void {
    this.loadData();
  }

  deleteSale(entry: SaleEntry): void {
    if (!entry.retailSaleId) return;
    this.formDialogs
      .openConfirm({
        title: 'Eliminar venta',
        message: `¿Eliminar la venta ${entry.saleId}?`,
        confirmLabel: 'Eliminar',
        confirmVariant: 'delete',
      })
      .subscribe((confirmed) => {
        if (!confirmed || !entry.retailSaleId) return;
        this.salesService.deleteRetailSale(entry.retailSaleId).subscribe({
          next: () => this.loadData(),
          error: (err) => {
            this.reportMessage = extractApiErrorMessage(err, 'No se pudo eliminar la venta');
          },
        });
      });
  }

  private overviewSub?: Subscription;

  loadData(): void {
    this.loading = true;
    this.loadError = false;

    // Cambio de mes rápido: la respuesta del mes anterior se descarta.
    this.overviewSub?.unsubscribe();
    this.overviewSub = this.salesService.getOverview(this.monthParam()).subscribe({
      next: ({ stats, entries }) => {
        this.stats = stats;
        this.entries = entries;
        this.channelFilters = buildChannelFilters(entries);
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.loadError = true;
      },
    });
  }

  generateReport(): void {
    if (this.loading) {
      this.reportMessage = 'Esperá a que termine de cargar el mes.';
      return;
    }
    if (!this.stats || !this.entries.length) {
      this.reportMessage = 'No hay ventas en el mes para armar el reporte.';
      return;
    }
    // Datos y mes tal como se ven ahora, aunque después se cambie de mes.
    const stats = this.stats;
    const entries = this.entries;
    const monthLabel = this.monthLabel;

    this.productsService.getProducts(undefined, { all: true }).subscribe({
      next: (products) => {
        void downloadSalesReportPdf(
          stats,
          entries,
          products,
          monthLabel,
        )
          .then(() => {
            this.reportMessage = `Listo: se descargó el reporte de ${monthLabel}.`;
          })
          .catch((err) => {
            this.reportMessage = extractApiErrorMessage(
              err,
              'No se pudo generar el reporte',
            );
          });
      },
      error: (err) => {
        this.reportMessage = extractApiErrorMessage(err, 'No se pudo generar el reporte');
      },
    });
  }

  shiftMonth(delta: number): void {
    this.viewMonth = new Date(
      this.viewMonth.getFullYear(),
      this.viewMonth.getMonth() + delta,
      1,
    );
    this.reportMessage = '';
    this.loadData();
  }

  private monthParam(): string {
    const month = String(this.viewMonth.getMonth() + 1).padStart(2, '0');
    return `${this.viewMonth.getFullYear()}-${month}`;
  }
}
