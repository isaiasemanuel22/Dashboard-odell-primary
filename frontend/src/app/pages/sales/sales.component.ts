import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  SaleEntry,
  SaleSource,
  SalesStats,
  ServiceType,
} from '../../core/models';
import { RealtimeService } from '../../core/services/realtime.service';
import { BreakpointService } from '../../core/services/breakpoint.service';
import { SalesService } from '../../core/services/sales.service';
import { FormDialogService } from '../../shared/form-dialogs/public-api';
import {
  DB_DATA_TABLE,
  DbStateMessageComponent,
  DbButtonComponent,
  OdlActionEvent,
  OdlColumn,
  OdlFilter,
  OdlRowAction,
  SalesStatsGridComponent,
  serviceTag,
} from '@general-components';
import { SALE_SOURCE_LABELS, SERVICE_TYPE_LABELS } from '../../shared/constants/labels';
import { extractApiErrorMessage } from '../../shared/utils/api-error';
import { downloadSalesReportPdf } from '../../shared/utils/sales-report.util';
import { ProductsService } from '../../core/services/products.service';

const SALE_AREAS: ServiceType[] = [
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
    SalesStatsGridComponent,
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
  stats: SalesStats | null = null;
  entries: SaleEntry[] = [];

  readonly monthLabel = new Date()
    .toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
    .replace(' de ', ' ');

  readonly monthName = new Date().toLocaleDateString('es-AR', { month: 'long' });

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

  onAction(event: OdlActionEvent<SaleEntry>): void {
    if (event.actionId === 'editar') this.openEditSale(event.row);
    if (event.actionId === 'eliminar') this.deleteSale(event.row);
    if (event.actionId === 'ver' && event.row.orderId) {
      void this.router.navigate(['/pedidos', event.row.orderId]);
    }
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
        alert(extractApiErrorMessage(err, 'No se pudo cargar la venta'));
      },
    });
  }

  onSaleSaved(): void {
    this.loadData();
  }

  deleteSale(entry: SaleEntry): void {
    if (!entry.retailSaleId) return;
    if (!confirm(`¿Eliminar la venta ${entry.saleId}?`)) return;

    this.salesService.deleteRetailSale(entry.retailSaleId).subscribe({
      next: () => this.loadData(),
      error: (err) => {
        alert(extractApiErrorMessage(err, 'No se pudo eliminar la venta'));
      },
    });
  }

  loadData(): void {
    this.loading = true;
    this.loadError = false;

    this.salesService.getOverview().subscribe({
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
    if (!this.stats || !this.entries.length) return;

    this.productsService.getProducts(undefined, { all: true }).subscribe({
      next: (products) => {
        downloadSalesReportPdf(this.stats!, this.entries, products);
      },
      error: (err) => {
        alert(extractApiErrorMessage(err, 'No se pudo generar el reporte'));
      },
    });
  }
}
