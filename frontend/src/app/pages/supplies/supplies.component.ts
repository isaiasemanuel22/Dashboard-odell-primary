import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { ColorConfig, ResinType, Supply, SupplyCategory } from '../../core/models';
import { SuppliesService, SettingsService } from '../../core/services/settings.service';
import {
  DbButtonComponent,
  DbPillGroupComponent,
  DbSkeletonComponent,
  DbStateMessageComponent,
  MobileBarComponent,
  SuppliesTableComponent,
} from '@general-components';
import {
  FILAMENT_TYPE_LABELS,
  RESIN_TYPE_LABELS,
  SUPPLY_CATEGORY_LABELS,
} from '../../shared/constants/labels';
import { FormDialogService } from '../../modals/public-api';
import { extractApiErrorMessage } from '../../shared/utils/api-error';
import { resolveColorLabel } from '../../shared/utils/color.helpers';
import { supplyCategoryFilters } from '../../shared/utils/list-filters';
import { CurrencyArsPipe } from '../../shared/pipes/labels.pipe';
import { SuppliesFacade } from '../../store/supplies/supplies.facade';

type CategoryFilter = SupplyCategory | 'all';
type StockFilter = 'all' | 'ok' | 'low';
type MobileChip = 'all' | 'low' | SupplyCategory;

@Component({
  selector: 'app-supplies',
  standalone: true,
  imports: [
    FormsModule,
    DbStateMessageComponent,
    DbButtonComponent,
    DbPillGroupComponent,
    DbSkeletonComponent,
    MobileBarComponent,
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
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly currency = new CurrencyArsPipe();

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

  get mobileCategoryChips(): { value: SupplyCategory; label: string }[] {
    return (Object.keys(SUPPLY_CATEGORY_LABELS) as SupplyCategory[]).map(
      (value) => ({ value, label: SUPPLY_CATEGORY_LABELS[value] }),
    );
  }

  get mobileChip(): MobileChip {
    if (this.stockFilter === 'low' && this.categoryFilter === 'all') {
      return 'low';
    }
    if (this.categoryFilter !== 'all' && this.stockFilter === 'all') {
      return this.categoryFilter;
    }
    if (this.stockFilter === 'all' && this.categoryFilter === 'all') {
      return 'all';
    }
    return this.categoryFilter !== 'all' ? this.categoryFilter : 'all';
  }

  ngOnInit(): void {
    const filtro = this.route.snapshot.queryParamMap.get('filtro');
    const stock = this.route.snapshot.queryParamMap.get('stock');
    if (filtro === 'stock_bajo' || stock === 'low') {
      this.stockFilter = 'low';
    }
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
    return this.supplies.filter((supply) => supply.quantity <= supply.minStock)
      .length;
  }

  get hasListFilters(): boolean {
    return (
      this.search.trim().length > 0 ||
      this.categoryFilter !== 'all' ||
      this.stockFilter !== 'all'
    );
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

  setMobileChip(chip: MobileChip): void {
    if (chip === 'all') {
      this.stockFilter = 'all';
      this.categoryFilter = 'all';
      return;
    }
    if (chip === 'low') {
      this.stockFilter = 'low';
      this.categoryFilter = 'all';
      return;
    }
    this.stockFilter = 'all';
    this.categoryFilter = chip;
  }

  isLowStock(supply: Supply): boolean {
    return supply.quantity <= supply.minStock;
  }

  formatQuantity(supply: Supply): string {
    const qty = Number(supply.quantity) || 0;
    const formatted = Number.isInteger(qty)
      ? String(qty)
      : qty.toLocaleString('es-AR', { maximumFractionDigits: 2 });
    return `${formatted} ${supply.unit}`;
  }

  mobileRowMeta(supply: Supply): string {
    const category = SUPPLY_CATEGORY_LABELS[supply.category] ?? supply.category;
    if (this.isLowStock(supply)) {
      const min = Number(supply.minStock) || 0;
      const minLabel = Number.isInteger(min)
        ? String(min)
        : min.toLocaleString('es-AR', { maximumFractionDigits: 2 });
      return `${category} · mínimo ${minLabel}`;
    }
    if (supply.unitPrice > 0) {
      return `${category} · ${this.currency.transform(supply.unitPrice)} / ${supply.unit}`;
    }
    return category;
  }

  stockLevelPercent(supply: Supply): number {
    if (supply.quantity <= 0) return 0;
    const target = Math.max(Number(supply.minStock) * 2, 1);
    return Math.min(100, Math.round((supply.quantity / target) * 100));
  }

  stockLevelColor(supply: Supply): string {
    return this.isLowStock(supply) ? '#B91C1C' : '#15803D';
  }

  private supplySearchText(supply: Supply): string {
    const material = supply.filamentType
      ? FILAMENT_TYPE_LABELS[supply.filamentType]
      : supply.resinType
        ? (RESIN_TYPE_LABELS[supply.resinType as ResinType] ?? supply.resinType)
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

  openPurchase(): void {
    void this.router.navigate(['/billetera'], { queryParams: { compra: '1' } });
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
    this.formDialogs
      .openConfirm({
        title: 'Eliminar insumo',
        message: `¿Eliminar "${supply.name}"?`,
        confirmLabel: 'Eliminar',
        confirmVariant: 'delete',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.suppliesService.deleteSupply(supply.id).subscribe({
          error: (err) => {
            this.formDialogs
              .openConfirm({
                title: 'No se pudo eliminar',
                message: extractApiErrorMessage(err, 'No se pudo eliminar el insumo'),
                confirmLabel: 'Entendido',
                alertOnly: true,
              })
              .subscribe();
          },
        });
      });
  }
}
