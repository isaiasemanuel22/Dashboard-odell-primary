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
  normalizeFilamentType,
} from '../../../shared/utils/filament-type.util';
import {
  CurrencyArsPipe,
  FilamentTypeLabelPipe,
} from '../../../shared/pipes/labels.pipe';
import {
  DbAutocompleteComponent,
  DbAutocompleteOption,
  DbButtonComponent,
  DbFormComponent,
  DbInputComponent,
  DbStateMessageComponent,
} from '@general-components';

@Component({
  selector: 'app-filament-settings',
  standalone: true,
  imports: [
    FormsModule,
    DbFormComponent,
    DbInputComponent,
    DbAutocompleteComponent,
    DbButtonComponent,
    CurrencyArsPipe,
    FilamentTypeLabelPipe,
    DbStateMessageComponent,
  ],
  templateUrl: './filament-settings.component.html',
  styleUrl: './filament-settings.component.scss',
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
