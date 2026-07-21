import {
  Component,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { GeneralSettings, ResinPriceConfig, ResinType } from '../../../core/models';
import { SettingsService } from '../../../core/services/settings.service';
import { resinTypeOptions } from '../../../shared/utils/select-options';
import {
  CurrencyArsPipe,
  ResinTypeLabelPipe,
} from '../../../shared/pipes/labels.pipe';
import {
  DbButtonComponent,
  DbFormComponent,
  DbInputComponent,
  DbSelectComponent,
  DbStateMessageComponent,
} from '@general-components';

@Component({
  selector: 'app-resin-settings',
  standalone: true,
  imports: [
    FormsModule,
    DbFormComponent,
    DbInputComponent,
    DbSelectComponent,
    DbButtonComponent,
    CurrencyArsPipe,
    ResinTypeLabelPipe,
    DbStateMessageComponent,
  ],
  templateUrl: './resin-settings.component.html',
  styleUrl: './resin-settings.component.scss',
})
export class ResinSettingsComponent implements OnInit, OnDestroy {
  private readonly settingsService = inject(SettingsService);
  private settingsSub?: Subscription;

  settings: GeneralSettings | null = null;
  message = '';

  newResin = { brand: '', resinType: ResinType.ESTANDAR, pricePerLiter: 0 };
  editingId: string | null = null;
  editForm = { brand: '', resinType: ResinType.ESTANDAR, pricePerLiter: 0 };

  readonly resinTypeOptions = resinTypeOptions();

  ngOnInit(): void {
    this.settingsSub = this.settingsService.watchGeneralSettings().subscribe((settings) => {
      if (!settings || this.editingId) return;
      this.settings = structuredClone(settings);
    });
    this.settingsService.getGeneralSettings(false).subscribe();
  }

  ngOnDestroy(): void {
    this.settingsSub?.unsubscribe();
  }

  addResinPrice(): void {
    if (!this.newResin.brand.trim()) return;
    this.settingsService.addResinPrice(this.newResin).subscribe({
      next: () => {
        this.newResin = {
          brand: '',
          resinType: ResinType.ESTANDAR,
          pricePerLiter: 0,
        };
        this.message = 'Precio de resina agregado';
      },
    });
  }

  startEdit(item: ResinPriceConfig): void {
    this.editingId = item.id;
    this.editForm = {
      brand: item.brand,
      resinType: item.resinType,
      pricePerLiter: item.pricePerLiter,
    };
  }

  cancelEdit(): void {
    this.editingId = null;
  }

  saveEdit(): void {
    if (!this.editingId || !this.editForm.brand.trim()) return;
    this.settingsService.updateResinPrice(this.editingId, this.editForm).subscribe({
      next: () => {
        this.message = 'Precio de resina actualizado';
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
}
