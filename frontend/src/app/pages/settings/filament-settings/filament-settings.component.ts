import {
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FilamentType, FilamentPriceConfig, GeneralSettings } from '../../../core/models';
import { SettingsService } from '../../../core/services/settings.service';
import { filamentTypeOptions } from '../../../shared/utils/select-options';
import {
  CurrencyArsPipe,
  FilamentTypeLabelPipe,
} from '../../../shared/pipes/labels.pipe';
import {
  DbButtonComponent,
  DbFormComponent,
  DbInputComponent,
  DbSelectComponent,
  DbStateMessageComponent,
} from '@general-components';

@Component({
  selector: 'app-filament-settings',
  standalone: true,
  imports: [
    FormsModule,
    DbFormComponent,
    DbInputComponent,
    DbSelectComponent,
    DbButtonComponent,
    CurrencyArsPipe,
    FilamentTypeLabelPipe,
    DbStateMessageComponent,
  ],
  templateUrl: './filament-settings.component.html',
  styleUrl: './filament-settings.component.scss',
})
export class FilamentSettingsComponent implements OnInit {
  private readonly settingsService = inject(SettingsService);

  settings: GeneralSettings | null = null;
  message = '';

  newFilament = { brand: '', materialType: FilamentType.PLA, pricePerKg: 0 };
  editingId: string | null = null;
  editForm = { brand: '', materialType: FilamentType.PLA, pricePerKg: 0 };

  readonly filamentTypeOptions = filamentTypeOptions();

  ngOnInit(): void {
    this.loadSettings();
  }

  loadSettings(): void {
    this.settingsService.getGeneralSettings().subscribe((s) => {
      this.settings = structuredClone(s);
    });
  }

  addFilamentPrice(): void {
    if (!this.newFilament.brand.trim()) return;
    this.settingsService.addFilamentPrice(this.newFilament).subscribe({
      next: () => {
        this.newFilament = {
          brand: '',
          materialType: FilamentType.PLA,
          pricePerKg: 0,
        };
        this.message =
          'Precio de filamento agregado. Los insumos vinculados se actualizaron.';
        this.loadSettings();
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
    if (!this.editingId || !this.editForm.brand.trim()) return;
    this.settingsService.updateFilamentPrice(this.editingId, this.editForm).subscribe({
      next: () => {
        this.message =
          'Precio de filamento actualizado. Los insumos vinculados se actualizaron.';
        this.editingId = null;
        this.loadSettings();
      },
    });
  }

  deleteFilamentPrice(id: string): void {
    if (!confirm('¿Eliminar este precio de filamento?')) return;
    this.settingsService.deleteFilamentPrice(id).subscribe(() => {
      this.message = 'Precio eliminado';
      this.loadSettings();
    });
  }
}
