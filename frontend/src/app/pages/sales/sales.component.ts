import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  SaleEntry,
  SaleSource,
  SalesStats,
} from '../../core/models';
import { RealtimeService } from '../../core/services/realtime.service';
import { SalesService } from '../../core/services/sales.service';
import { FormDialogService } from '../../shared/form-dialogs/public-api';
import {
  DbListToolbarComponent,
  DbStateMessageComponent,
  DbButtonComponent,
  SalesStatsGridComponent,
  SalesTableComponent,
} from '@general-components';
import { SALE_SOURCE_LABELS } from '../../shared/constants/labels';
import { extractApiErrorMessage } from '../../shared/utils/api-error';
import {
  clearCreateQuery,
  shouldOpenCreateFromQuery,
} from '../../shared/utils/create-from-query.util';
import { ListFilterOption } from '../../components/db-list-toolbar/db-list-toolbar.component';

type SalesFilter = 'all' | SaleSource;

@Component({
  selector: 'app-sales',
  standalone: true,
  imports: [
    DbListToolbarComponent,
    DbStateMessageComponent,
    DbButtonComponent,
    SalesStatsGridComponent,
    SalesTableComponent,
  ],
  templateUrl: './sales.component.html',
  styleUrl: './sales.component.scss',
})
export class SalesComponent implements OnInit {
  private readonly salesService = inject(SalesService);
  private readonly realtime = inject(RealtimeService);
  private readonly formDialogs = inject(FormDialogService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  loading = true;
  loadError = false;
  stats: SalesStats | null = null;
  entries: SaleEntry[] = [];
  search = '';
  salesFilter: SalesFilter = 'all';

  readonly filters: ListFilterOption<SalesFilter>[] = [
    { value: 'all', label: 'Todas' },
    { value: SaleSource.RETAIL, label: SALE_SOURCE_LABELS[SaleSource.RETAIL] },
    { value: SaleSource.ORDER, label: SALE_SOURCE_LABELS[SaleSource.ORDER] },
  ];

  ngOnInit(): void {
    this.loadData();
    this.realtime.bindReload(this.destroyRef, ['sales', 'orders'], () =>
      this.loadData(),
    );

    if (shouldOpenCreateFromQuery(this.route)) {
      this.openCreateSale();
      clearCreateQuery(this.router);
    }
  }

  get filteredEntries(): SaleEntry[] {
    const term = this.search.trim().toLowerCase();

    return this.entries
      .filter((entry) => {
        if (this.salesFilter === 'all') return true;
        return entry.source === this.salesFilter;
      })
      .filter((entry) => {
        if (!term) return true;
        return [
          entry.saleId,
          entry.customerName ?? '',
          entry.notes ?? '',
          entry.orderId ?? '',
          ...entry.items.map(
            (item) => `${item.productName} ${item.quantity}`,
          ),
        ]
          .join(' ')
          .toLowerCase()
          .includes(term);
      });
  }

  setSalesFilter(filter: SalesFilter): void {
    this.salesFilter = filter;
  }

  openCreateSale(): void {
    this.formDialogs.openSale().subscribe((saved) => {
      if (saved) this.onSaleSaved();
    });
  }

  openEditSale(entry: SaleEntry): void {
    if (!entry.retailSaleId) return;

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
}
