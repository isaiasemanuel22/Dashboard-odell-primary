import {
  Component,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ColorConfig, GeneralSettings } from '../../../core/models';
import { SettingsService } from '../../../core/services/settings.service';
import {
  DbButtonComponent,
  DbFormComponent,
  DbInputComponent,
  DbStateMessageComponent,
} from '@general-components';

@Component({
  selector: 'app-color-settings',
  standalone: true,
  imports: [
    FormsModule,
    DbFormComponent,
    DbInputComponent,
    DbButtonComponent,
    DbStateMessageComponent,
  ],
  templateUrl: './color-settings.component.html',
  styleUrl: './color-settings.component.scss',
})
export class ColorSettingsComponent implements OnInit, OnDestroy {
  private readonly settingsService = inject(SettingsService);
  private settingsSub?: Subscription;

  settings: GeneralSettings | null = null;
  message = '';

  newColor = { name: '', hex: '#000000' };
  editingId: string | null = null;
  editForm = { name: '', hex: '#000000' };

  ngOnInit(): void {
    this.settingsSub = this.settingsService.watchGeneralSettings().subscribe((settings) => {
      this.settings = settings ? structuredClone(settings) : null;
    });
    this.settingsService.getGeneralSettings(false).subscribe();
  }

  ngOnDestroy(): void {
    this.settingsSub?.unsubscribe();
  }

  get previewHex(): string {
    const hex = this.newColor.hex.trim();
    if (!hex) return '#CCCCCC';
    return hex.startsWith('#') ? hex : `#${hex}`;
  }

  addColor(): void {
    if (!this.newColor.name.trim() || !this.newColor.hex.trim()) return;

    this.settingsService.addColor({ ...this.newColor }).subscribe({
      next: () => {
        this.newColor = { name: '', hex: '#000000' };
        this.message = 'Color agregado al catálogo.';
      },
    });
  }

  startEdit(item: ColorConfig): void {
    this.editingId = item.id;
    this.editForm = { name: item.name, hex: item.hex };
  }

  cancelEdit(): void {
    this.editingId = null;
  }

  saveEdit(): void {
    if (!this.editingId || !this.editForm.name.trim() || !this.editForm.hex.trim()) {
      return;
    }

    this.settingsService.updateColor(this.editingId, { ...this.editForm }).subscribe({
      next: () => {
        this.message = 'Color actualizado.';
        this.editingId = null;
      },
    });
  }

  deleteColor(id: string): void {
    if (!confirm('¿Eliminar este color del catálogo?')) return;
    this.settingsService.deleteColor(id).subscribe({
      next: () => {
        this.message = 'Color eliminado.';
      },
      error: () => {
        this.message =
          'No se pudo eliminar: el color está asignado a uno o más insumos.';
      },
    });
  }
}
