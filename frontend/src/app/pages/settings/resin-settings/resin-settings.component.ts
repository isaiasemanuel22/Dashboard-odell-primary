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
import { RESIN_TYPE_LABELS } from '../../../shared/constants/labels';
import { resinTypeOptions } from '../../../shared/utils/select-options';
import {
  DbButtonComponent,
  DbInputComponent,
  DbSelectComponent,
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
    DbButtonComponent,
    DbInputComponent,
    DbSelectComponent,
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

  newResin = { brand: '', resinType: ResinType.ESTANDAR, pricePerLiter: 0 };
  editingId: string | null = null;
  editForm = { brand: '', resinType: ResinType.ESTANDAR, pricePerLiter: 0 };
  search = '';
  typeFilter: ResinType | 'all' = 'all';

  readonly priceActions: OdlRowAction<ResinPriceConfig>[] = [
    { id: 'editar', label: 'Editar' },
    { id: 'eliminar', label: 'Eliminar', danger: true },
  ];

  readonly priceColumns: OdlColumn<ResinPriceConfig>[] = [
    { key: 'brand', header: 'Marca', type: 'primary' },
    { key: 'resinType', header: 'Tipo', value: (item) => RESIN_TYPE_LABELS[item.resinType] },
    { key: 'pricePerLiter', header: 'Precio / L', type: 'money' },
  ];

  readonly resinTypeOptions = resinTypeOptions();

  get typeFilters(): { value: ResinType; label: string }[] {
    return this.resinTypeOptions;
  }

  get visiblePrices(): ResinPriceConfig[] {
    const query = this.search.trim().toLowerCase();
    return (this.settings?.resinPrices ?? []).filter((item) => {
      const matchesType = this.typeFilter === 'all' || item.resinType === this.typeFilter;
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

  ngOnInit(): void {
    this.settingsSub = this.settingsService.watchGeneralSettings().subscribe((settings) => {
      this.settings = settings ? structuredClone(settings) : null;
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
        this.message =
          'Precio de resina agregado. Los insumos vinculados se actualizaron.';
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
    queueMicrotask(() => document.getElementById('resin-brand')?.focus());
  }

  cancelEdit(): void {
    this.editingId = null;
  }

  saveEdit(): void {
    if (!this.editingId || !this.editForm.brand.trim()) return;
    this.settingsService.updateResinPrice(this.editingId, this.editForm).subscribe({
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
}
