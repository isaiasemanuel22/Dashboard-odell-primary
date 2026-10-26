import {
  Component,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { FilamentPriceConfig, FilamentType, GeneralSettings } from '../../../core/models';
import { SettingsService } from '../../../core/services/settings.service';
import {
  buildFilamentTypeOptions,
  filamentTypeDisplayLabel,
  normalizeFilamentType,
} from '../../../shared/utils/filament-type.util';
import {
  DbAutocompleteComponent,
  DbAutocompleteOption,
  DbButtonComponent,
  DbInputComponent,
  DbStateMessageComponent,
  DB_DATA_TABLE,
  OdlActionEvent,
  OdlColumn,
  OdlRowAction,
} from '@general-components';

@Component({
  selector: 'app-filament-settings',
  standalone: true,
  imports: [
    FormsModule,
    DbAutocompleteComponent,
    DbButtonComponent,
    DbInputComponent,
    DbStateMessageComponent,
    ...DB_DATA_TABLE,
  ],
  templateUrl: './filament-settings.component.html',
  styleUrl: '../material-price-settings.scss',
})
export class FilamentSettingsComponent implements OnInit, OnDestroy {
  private readonly settingsService = inject(SettingsService);
  private settingsSub?: Subscription;

  settings: GeneralSettings | null = null;
  message = '';

  newFilament = { brand: '', materialType: FilamentType.PLA as string, pricePerKg: 0 };
  editingId: string | null = null;
  editForm = { brand: '', materialType: FilamentType.PLA as string, pricePerKg: 0 };
  extraFilamentTypes: string[] = [];
  search = '';
  typeFilter = 'all';

  readonly priceActions: OdlRowAction<FilamentPriceConfig>[] = [
    { id: 'editar', label: 'Editar' },
    { id: 'eliminar', label: 'Eliminar', danger: true },
  ];

  readonly priceColumns: OdlColumn<FilamentPriceConfig>[] = [
    { key: 'brand', header: 'Marca', type: 'primary' },
    {
      key: 'materialType',
      header: 'Tipo',
      value: (item) => filamentTypeDisplayLabel(item.materialType),
    },
    { key: 'pricePerKg', header: 'Precio / kg', type: 'money' },
  ];

  ngOnInit(): void {
    this.settingsSub = this.settingsService.watchGeneralSettings().subscribe((settings) => {
      this.settings = settings ? structuredClone(settings) : null;
    });
    this.settingsService.getGeneralSettings(false).subscribe();
  }

  ngOnDestroy(): void {
    this.settingsSub?.unsubscribe();
  }

  get filamentTypeOptions(): DbAutocompleteOption[] {
    return buildFilamentTypeOptions(
      this.settings?.filamentPrices ?? [],
      this.extraFilamentTypes,
    );
  }

  get typeFilters(): { value: string; label: string }[] {
    const types = new Map<string, string>();
    for (const item of this.settings?.filamentPrices ?? []) {
      const value = normalizeFilamentType(item.materialType);
      if (!value || types.has(value)) continue;
      types.set(value, filamentTypeDisplayLabel(value));
    }
    return [...types.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es'));
  }

  get visiblePrices(): FilamentPriceConfig[] {
    const query = this.search.trim().toLowerCase();
    return (this.settings?.filamentPrices ?? []).filter((item) => {
      const matchesType =
        this.typeFilter === 'all' ||
        normalizeFilamentType(item.materialType) === this.typeFilter;
      const matchesSearch = !query || item.brand.toLowerCase().includes(query);
      return matchesType && matchesSearch;
    });
  }

  focusCreate(): void {
    this.cancelEdit();
    queueMicrotask(() => document.getElementById('filament-brand')?.focus());
  }

  onPriceAction(event: OdlActionEvent<FilamentPriceConfig>): void {
    if (event.actionId === 'editar') this.startEdit(event.row);
    if (event.actionId === 'eliminar') this.deleteFilamentPrice(event.row.id);
  }

  addFilamentPrice(): void {
    if (!this.newFilament.brand.trim() || !this.newFilament.materialType.trim()) return;

    this.settingsService
      .addFilamentPrice({
        ...this.newFilament,
        materialType: normalizeFilamentType(this.newFilament.materialType),
      })
      .subscribe({
        next: () => {
          this.newFilament = {
            brand: '',
            materialType: FilamentType.PLA,
            pricePerKg: 0,
          };
          this.message =
            'Precio de filamento agregado. Los insumos vinculados se actualizaron.';
        },
      });
  }

  startEdit(item: FilamentPriceConfig): void {
    this.editingId = item.id;
    this.editForm = {
      brand: item.brand,
      materialType: item.materialType,
      pricePerKg: item.pricePerKg,
    };
    queueMicrotask(() => document.getElementById('filament-brand')?.focus());
  }

  cancelEdit(): void {
    this.editingId = null;
  }

  saveEdit(): void {
    if (!this.editingId || !this.editForm.brand.trim() || !this.editForm.materialType.trim()) {
      return;
    }

    this.settingsService
      .updateFilamentPrice(this.editingId, {
        ...this.editForm,
        materialType: normalizeFilamentType(this.editForm.materialType),
      })
      .subscribe({
        next: () => {
          this.message =
            'Precio de filamento actualizado. Los insumos vinculados se actualizaron.';
          this.editingId = null;
        },
      });
  }

  deleteFilamentPrice(id: string): void {
    if (!confirm('¿Eliminar este precio de filamento?')) return;
    this.settingsService.deleteFilamentPrice(id).subscribe(() => {
      this.message = 'Precio eliminado';
    });
  }

  onFilamentTypeCreated(type: string): void {
    const normalized = normalizeFilamentType(type);
    if (!normalized || this.extraFilamentTypes.includes(normalized)) return;
    this.extraFilamentTypes = [...this.extraFilamentTypes, normalized];
  }
}
