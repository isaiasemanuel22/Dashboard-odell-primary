import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { Supply, SupplyType } from '../../core/models';
import { SuppliesService } from '../../core/services/settings.service';
import { RealtimeService } from '../../core/services/realtime.service';
import {
  DbListToolbarComponent,
  DbStateMessageComponent,
  DbButtonComponent,
  SuppliesTableComponent,
} from '@general-components';
import { FormDialogService } from '../../shared/form-dialogs/public-api';
import { supplyTypeFilters } from '../../shared/utils/list-filters';

type TypeFilter = SupplyType | 'all';

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
  private readonly realtime = inject(RealtimeService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly formDialogs = inject(FormDialogService);

  supplies: Supply[] = [];
  loading = true;
  search = '';
  typeFilter: TypeFilter = 'all';

  readonly typeFilters = supplyTypeFilters();

  ngOnInit(): void {
    this.loadSupplies();
    this.realtime.bindReload(this.destroyRef, 'supplies', () =>
      this.loadSupplies(),
    );
  }

  get filteredSupplies(): Supply[] {
    return this.supplies.filter((s) => {
      const matchesSearch =
        !this.search ||
        s.name.toLowerCase().includes(this.search.toLowerCase());
      const matchesType = this.typeFilter === 'all' || s.type === this.typeFilter;
      return matchesSearch && matchesType;
    });
  }

  loadSupplies(): void {
    this.loading = true;
    this.suppliesService.getSupplies().subscribe({
      next: (items) => {
        this.supplies = items;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  openCreate(): void {
    this.formDialogs.openSupply().subscribe((saved) => {
      if (saved) this.loadSupplies();
    });
  }

  openEdit(supply: Supply): void {
    this.formDialogs.openSupply(supply).subscribe((saved) => {
      if (saved) this.loadSupplies();
    });
  }

  deleteSupply(supply: Supply): void {
    if (!confirm(`¿Eliminar "${supply.name}"?`)) return;
    this.suppliesService.deleteSupply(supply.id).subscribe(() => this.loadSupplies());
  }
}
