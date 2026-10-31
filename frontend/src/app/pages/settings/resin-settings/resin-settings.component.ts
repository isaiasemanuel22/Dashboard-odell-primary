import {
  Component,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable, Subscription, of, switchMap } from 'rxjs';
import {
  GeneralSettings,
  ResinPriceConfig,
  ResinTypeConfig,
} from '../../../core/models';
import { SettingsService } from '../../../core/services/settings.service';
import {
  buildResinTypeOptions,
  resinTypeDisplayLabel,
  resolveResinTypeIdFromInput,
} from '../../../shared/utils/resin-type.util';
import {
  DbAutocompleteComponent,
  DbAutocompleteOption,
  DbButtonComponent,
  DbInputComponent,
  DbPillGroupComponent,
  DbStateMessageComponent,
  DB_DATA_TABLE,
  OdlActionEvent,
  OdlColumn,
  OdlRowAction,
} from '@general-components';

@Component({
  selector: 'app-resin-settings',
  standalone: true,
  imports: [
    FormsModule,
    DbAutocompleteComponent,
    DbButtonComponent,
    DbInputComponent,
    DbPillGroupComponent,
    DbStateMessageComponent,
    ...DB_DATA_TABLE,
  ],
  templateUrl: './resin-settings.component.html',
  styleUrl: '../material-price-settings.scss',
})
export class ResinSettingsComponent implements OnInit, OnDestroy {
  private readonly settingsService = inject(SettingsService);
  private settingsSub?: Subscription;

  settings: GeneralSettings | null = null;
  message = '';

  newResin = { brand: '', resinType: '', pricePerLiter: 0 };
  editingId: string | null = null;
  editForm = { brand: '', resinType: '', pricePerLiter: 0 };
  extraResinTypes: string[] = [];
  search = '';
  typeFilter = 'all';

  readonly priceActions: OdlRowAction<ResinPriceConfig>[] = [
    { id: 'editar', label: 'Editar' },
    { id: 'eliminar', label: 'Eliminar', danger: true },
  ];

  readonly priceColumns: OdlColumn<ResinPriceConfig>[] = [
    { key: 'brand', header: 'Marca', type: 'primary' },
    {
      key: 'resinType',
      header: 'Tipo',
      value: (item) =>
        resinTypeDisplayLabel(
          item.resinTypeId || String(item.resinType),
          this.settings?.resinTypes ?? [],
        ),
    },
    { key: 'pricePerLiter', header: 'Precio / L', type: 'money' },
  ];

  ngOnInit(): void {
    this.settingsSub = this.settingsService.watchGeneralSettings().subscribe((settings) => {
      this.settings = settings ? structuredClone(settings) : null;
      if (this.settings && !this.newResin.resinType) {
        const first = this.settings.resinTypes?.[0];
        if (first) this.newResin.resinType = first.id;
      }
    });
    this.settingsService.getGeneralSettings(false).subscribe();
  }

  ngOnDestroy(): void {
    this.settingsSub?.unsubscribe();
  }

  get resinTypeOptions(): DbAutocompleteOption[] {
    return buildResinTypeOptions(
      this.settings?.resinTypes ?? [],
      this.settings?.resinPrices ?? [],
      this.extraResinTypes,
      'id',
    );
  }

  get typeFilters(): { value: string; label: string }[] {
    const types = new Map<string, string>();
    const catalog = this.settings?.resinTypes ?? [];
    for (const item of this.settings?.resinPrices ?? []) {
      const value = item.resinTypeId || String(item.resinType);
      if (!value || types.has(value)) continue;
      types.set(value, resinTypeDisplayLabel(value, catalog));
    }
    return [...types.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es'));
  }

  get typeFilterOptions(): { value: string; label: string }[] {
    return [{ value: 'all', label: 'Todos' }, ...this.typeFilters];
  }

  get visiblePrices(): ResinPriceConfig[] {
    const query = this.search.trim().toLowerCase();
    return (this.settings?.resinPrices ?? []).filter((item) => {
      const typeKey = item.resinTypeId || String(item.resinType);
      const matchesType =
        this.typeFilter === 'all' || typeKey === this.typeFilter;
      const matchesSearch = !query || item.brand.toLowerCase().includes(query);
      return matchesType && matchesSearch;
    });
  }

  focusCreate(): void {
    this.cancelEdit();
    queueMicrotask(() => document.getElementById('resin-brand')?.focus());
  }

  onPriceAction(event: OdlActionEvent<ResinPriceConfig>): void {
    if (event.actionId === 'editar') this.startEdit(event.row);
    if (event.actionId === 'eliminar') this.deleteResinPrice(event.row.id);
  }

  addResinPrice(): void {
    if (!this.newResin.brand.trim() || !this.newResin.resinType.trim()) {
      return;
    }

    this.resolveResinTypeId(this.newResin.resinType)
      .pipe(
        switchMap((resinTypeId) =>
          this.settingsService.addResinPrice({
            brand: this.newResin.brand,
            resinTypeId,
            resinType: resinTypeId,
            pricePerLiter: this.newResin.pricePerLiter,
          }),
        ),
      )
      .subscribe({
        next: () => {
          const first = this.settings?.resinTypes?.[0];
          this.newResin = {
            brand: '',
            resinType: first?.id ?? '',
            pricePerLiter: 0,
          };
          this.message =
            'Precio de resina agregado. Los insumos vinculados se actualizaron.';
        },
      });
  }

  startEdit(item: ResinPriceConfig): void {
    this.editingId = item.id;
    this.editForm = {
      brand: item.brand,
      resinType: item.resinTypeId || String(item.resinType),
      pricePerLiter: item.pricePerLiter,
    };
    queueMicrotask(() => document.getElementById('resin-brand')?.focus());
  }

  cancelEdit(): void {
    this.editingId = null;
  }

  saveEdit(): void {
    if (!this.editingId || !this.editForm.brand.trim() || !this.editForm.resinType.trim()) {
      return;
    }

    this.resolveResinTypeId(this.editForm.resinType)
      .pipe(
        switchMap((resinTypeId) =>
          this.settingsService.updateResinPrice(this.editingId!, {
            brand: this.editForm.brand,
            resinTypeId,
            resinType: resinTypeId,
            pricePerLiter: this.editForm.pricePerLiter,
          }),
        ),
      )
      .subscribe({
        next: () => {
          this.message =
            'Precio de resina actualizado. Los insumos vinculados se actualizaron.';
          this.editingId = null;
        },
      });
  }

  deleteResinPrice(id: string): void {
    if (!confirm('¿Eliminar este precio de resina?')) return;
    this.settingsService.deleteResinPrice(id).subscribe(() => {
      this.message = 'Precio eliminado';
    });
  }

  onResinTypeCreated(type: string): void {
    const normalized = type.trim();
    if (!normalized || this.extraResinTypes.includes(normalized)) return;
    this.extraResinTypes = [...this.extraResinTypes, normalized];
  }

  private resolveResinTypeId(raw: string): Observable<string> {
    const catalog = this.settings?.resinTypes ?? [];
    const existingId = resolveResinTypeIdFromInput(raw, catalog);
    if (existingId) {
      return of(existingId);
    }
    return this.settingsService.addResinType({ name: raw.trim() }).pipe(
      switchMap((created: ResinTypeConfig) => of(created.id)),
    );
  }
}
