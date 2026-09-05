import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ColorConfig, Supply, SupplyCategory } from '../../core/models';
import { SuppliesService, SettingsService } from '../../core/services/settings.service';
import {
  DbListToolbarComponent,
  DbStateMessageComponent,
  DbButtonComponent,
  SuppliesTableComponent,
} from '@general-components';
import { FormDialogService } from '../../shared/form-dialogs/public-api';
import { supplyCategoryFilters } from '../../shared/utils/list-filters';
import { SuppliesFacade } from '../../store/supplies/supplies.facade';

type CategoryFilter = SupplyCategory | 'all';

@Component({
  selector: 'app-supplies',
  standalone: true,
  imports: [
    DbListToolbarComponent,
    DbStateMessageComponent,
    DbButtonComponent,
    SuppliesTableComponent,
  ],
  templateUrl: './supplies.component.html',
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

  readonly categoryFilters = supplyCategoryFilters();

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

  get filteredSupplies(): Supply[] {
    return this.supplies.filter((s) => {
      const matchesSearch =
        !this.search ||
        s.name.toLowerCase().includes(this.search.toLowerCase());
      const matchesCategory =
        this.categoryFilter === 'all' || s.category === this.categoryFilter;
      return matchesSearch && matchesCategory;
    });
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
