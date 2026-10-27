import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ColorConfig, Supply, SupplyCategory } from '../../core/models';
import { SuppliesService, SettingsService } from '../../core/services/settings.service';
import {
  DbButtonComponent,
  DbPillGroupComponent,
  DbStateMessageComponent,
  SuppliesTableComponent,
} from '@general-components';
import {
  FILAMENT_TYPE_LABELS,
  RESIN_TYPE_LABELS,
  SUPPLY_CATEGORY_LABELS,
} from '../../shared/constants/labels';
import { FormDialogService } from '../../shared/form-dialogs/public-api';
import { resolveColorLabel } from '../../shared/utils/color.helpers';
import { supplyCategoryFilters } from '../../shared/utils/list-filters';
import { SuppliesFacade } from '../../store/supplies/supplies.facade';

type CategoryFilter = SupplyCategory | 'all';
type StockFilter = 'all' | 'ok' | 'low';

@Component({
  selector: 'app-supplies',
  standalone: true,
  imports: [
    FormsModule,
    DbStateMessageComponent,
    DbButtonComponent,
    DbPillGroupComponent,
    SuppliesTableComponent,
  ],
  templateUrl: './supplies.component.html',
  styleUrl: './supplies.component.scss',
})
export class SuppliesComponent implements OnInit {
  private readonly suppliesService = inject(SuppliesService);
  private readonly suppliesFacade = inject(SuppliesFacade);
  private readonly settingsService = inject(SettingsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly formDialogs = inject(FormDialogService);

  supplies: Supply[] = [];
  colorCatalog: ColorConfig[] = [];
  loading = true;
  search = '';
  categoryFilter: CategoryFilter = 'all';
  stockFilter: StockFilter = 'all';

  readonly stockFilters: { value: StockFilter; label: string }[] = [
    { value: 'all', label: 'Todos' },
    { value: 'ok', label: 'Stock OK' },
    { value: 'low', label: 'Stock bajo' },
  ];

  get categoryFilters() {
    return supplyCategoryFilters().map((filter) =>
      filter.value === 'all' ? { ...filter, label: 'Todas' } : filter,
    );
  }

  ngOnInit(): void {
    this.loadColorCatalog();

    this.suppliesFacade.loading$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((loading) => {
        this.loading = loading;
      });

    this.suppliesService
      .watchSupplies()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((items) => {
        this.supplies = items;
      });
  }

  private loadColorCatalog(): void {
    const cached = this.settingsService.peekGeneralSettings();
    if (cached) {
      this.colorCatalog = cached.colors ?? [];
      return;
    }

    this.settingsService.getGeneralSettings().subscribe({
      next: (settings) => {
        this.colorCatalog = settings.colors ?? [];
      },
    });
  }

  get lowStockCount(): number {
    return this.supplies.filter((supply) => supply.quantity <= supply.minStock).length;
  }

  get hasListFilters(): boolean {
    return this.search.trim().length > 0 || this.categoryFilter !== 'all' || this.stockFilter !== 'all';
  }

  get emptyMessage(): string {
    if (this.supplies.length > 0 && this.hasListFilters) {
      return 'No hay insumos que coincidan con la búsqueda o el filtro.';
    }
    return 'No hay insumos para mostrar.';
  }

  get filteredSupplies(): Supply[] {
    const term = this.search.trim().toLowerCase();
    return this.supplies.filter((s) => {
      const matchesSearch = !term || this.supplySearchText(s).includes(term);
      const matchesCategory =
        this.categoryFilter === 'all' || s.category === this.categoryFilter;
      const low = s.quantity <= s.minStock;
      const matchesStock =
        this.stockFilter === 'all' ||
        (this.stockFilter === 'low' && low) ||
        (this.stockFilter === 'ok' && !low);
      return matchesSearch && matchesCategory && matchesStock;
    });
  }

  private supplySearchText(supply: Supply): string {
    const material = supply.filamentType
      ? FILAMENT_TYPE_LABELS[supply.filamentType]
      : supply.resinType
        ? RESIN_TYPE_LABELS[supply.resinType]
        : '';
    return [
      supply.name,
      supply.brand,
      SUPPLY_CATEGORY_LABELS[supply.category],
      material,
      supply.colorId
        ? resolveColorLabel(supply.colorId, this.colorCatalog)
        : '',
    ]
      .filter((part) => Boolean(part))
      .join(' ')
      .toLowerCase();
  }

  openCreate(): void {
    const defaultCategory =
      this.categoryFilter === 'all' ? undefined : this.categoryFilter;
    this.formDialogs.openSupply(null, defaultCategory).subscribe();
  }

  openEdit(supply: Supply): void {
    this.formDialogs.openSupply(supply).subscribe();
  }

  deleteSupply(supply: Supply): void {
    if (!confirm(`¿Eliminar "${supply.name}"?`)) return;
    this.suppliesService.deleteSupply(supply.id).subscribe();
  }
}
