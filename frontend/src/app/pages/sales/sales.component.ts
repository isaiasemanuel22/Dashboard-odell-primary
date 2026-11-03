import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  AreaProfitBalance,
  ProfitArea,
  SaleEntry,
  SaleSource,
  SalesStats,
  ServiceType,
} from '../../core/models';
import { RealtimeService } from '../../core/services/realtime.service';
import { BreakpointService } from '../../core/services/breakpoint.service';
import { SalesService } from '../../core/services/sales.service';
import { FormDialogService } from '../../modals/public-api';
import {
  DB_DATA_TABLE,
  DbStateMessageComponent,
  DbButtonComponent,
  MobileBarComponent,
  OdlActionEvent,
  OdlColumn,
  OdlFilter,
  OdlRowAction,
  SalesStatsGridComponent,
  serviceTag,
} from '@general-components';
import {
  AreaServiceType,
  SALE_SOURCE_LABELS,
  SERVICE_TYPE_LABELS,
} from '../../shared/constants/labels';
import { extractApiErrorMessage } from '../../shared/utils/api-error';
import { formatDateDayMonth } from '../../shared/utils/date-format.util';
import { pluralize } from '../../shared/utils/order.helpers';
import { downloadSalesReportPdf } from '../../shared/utils/sales-report.util';
import { salesChannelLabel } from '../../shared/utils/v1-labels.util';
import { CurrencyArsPipe } from '../../shared/pipes/labels.pipe';
import { ProductsService } from '../../core/services/products.service';

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
    SalesStatsGridComponent,
    CurrencyArsPipe,
    ...DB_DATA_TABLE,
  ],
  templateUrl: './sales.component.html',
  styleUrl: './sales.component.scss',
})
export class SalesComponent implements OnInit {
  private readonly salesService = inject(SalesService);
  private readonly productsService = inject(ProductsService);
  private readonly realtime = inject(RealtimeService);
  private readonly formDialogs = inject(FormDialogService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly breakpoint = inject(BreakpointService);

  loading = true;
  loadError = false;
  reportMessage = '';
  stats: SalesStats | null = null;
  entries: SaleEntry[] = [];
  private viewMonth = new Date();

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
    return pluralize(this.entries.length, 'venta', 'ventas');
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

  readonly sourceFilters: OdlFilter<SaleEntry>[] = [
    { id: 'all', label: 'Todas' },
    {
      id: SaleSource.RETAIL,
      label: SALE_SOURCE_LABELS[SaleSource.RETAIL],
      predicate: (entry) => entry.source === SaleSource.RETAIL,
    },
    {
      id: SaleSource.ORDER,
      label: SALE_SOURCE_LABELS[SaleSource.ORDER],
      predicate: (entry) => entry.source === SaleSource.ORDER,
    },
  ];

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
  ];

  readonly columns: OdlColumn<SaleEntry>[] = [
    { key: 'saleId', header: 'Venta', type: 'primary' },
    { key: 'customerName', header: 'Cliente', value: (entry) => entry.customerName || 'Sin cliente' },
    {
      key: 'source',
      header: 'Tipo',
      type: 'badge',
      badge: (entry) => ({
        label: SALE_SOURCE_LABELS[entry.source],
        tone: entry.source === SaleSource.ORDER ? 'info' : 'neutral',
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
    { key: 'profit', header: 'Ganancia', type: 'signedMoney' },
    { key: 'total', header: 'Total', type: 'money' },
  ];

  get emptyText(): string {
    return `No hay ventas registradas en ${this.monthName}.`;
  }

  ngOnInit(): void {
    this.loadData();
    this.realtime.bindReload(this.destroyRef, ['sales', 'orders'], () =>
      this.loadData(),
    );
  }

  openCreateSale(): void {
    void this.router.navigate(['/ventas/nueva']);
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

  areaLabel(area: ProfitArea): string {
    return SERVICE_TYPE_LABELS[area];
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
    if (entry.source === SaleSource.RETAIL) {
      if (entry.editable) return `${day} · editable`;
      const count = entry.items.reduce((sum, item) => sum + item.quantity, 0);
      return `${day} · ${pluralize(count, 'producto', 'productos')}`;
    }
    const channel = salesChannelLabel(entry.salesChannel);
    return channel ? `Entregado ${day} · ${channel}` : `Entregado ${day}`;
  }

  onAction(event: OdlActionEvent<SaleEntry>): void {
    if (event.actionId === 'editar') this.openEditSale(event.row);
    if (event.actionId === 'eliminar') this.deleteSale(event.row);
    if (event.actionId === 'ver' && event.row.orderId) {
      void this.router.navigate(['/pedidos', event.row.orderId]);
    }
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

  loadData(): void {
    this.loading = true;
    this.loadError = false;

    this.salesService.getOverview(this.monthParam()).subscribe({
      next: ({ stats, entries }) => {
        this.stats = stats;
        this.entries = entries;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.loadError = true;
      },
    });
  }

  generateReport(): void {
    if (!this.stats || !this.entries.length) {
      this.reportMessage = 'No hay ventas en el mes para armar el reporte.';
      return;
    }

    this.productsService.getProducts(undefined, { all: true }).subscribe({
      next: (products) => {
        void downloadSalesReportPdf(
          this.stats!,
          this.entries,
          products,
          this.monthLabel,
        )
          .then(() => {
            this.reportMessage = `Listo: se descargó el reporte de ${this.monthLabel}.`;
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
