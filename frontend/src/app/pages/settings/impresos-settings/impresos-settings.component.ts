import {
  Component,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import {
  GeneralSettings,
  ImpresoWithCost,
  PaperType,
} from '../../../core/models';
import { ImpresosService } from '../../../core/services/impresos.service';
import { SettingsService } from '../../../core/services/settings.service';
import { CurrencyArsPipe } from '../../../shared/pipes/labels.pipe';
import { formatPrintDimensionsCm } from '../../../shared/utils/estampado.helpers';
import { FormDialogService } from '../../../shared/form-dialogs/public-api';
import {
  DbButtonComponent,
  DbFormComponent,
  DbFormGridComponent,
  DbInputComponent,
  DbStateMessageComponent,
} from '@general-components';

interface PaperGroup {
  type: PaperType;
  label: string;
  items: ImpresoWithCost[];
}

@Component({
  selector: 'app-impresos-settings',
  standalone: true,
  imports: [
    FormsModule,
    DbFormComponent,
    DbFormGridComponent,
    DbInputComponent,
    DbButtonComponent,
    CurrencyArsPipe,
    DbStateMessageComponent,
  ],
  templateUrl: './impresos-settings.component.html',
  styleUrl: './impresos-settings.component.scss',
})
export class ImpresosSettingsComponent implements OnInit, OnDestroy {
  private readonly settingsService = inject(SettingsService);
  private readonly impresosService = inject(ImpresosService);
  private readonly formDialogs = inject(FormDialogService);
  private settingsSub?: Subscription;

  settings: GeneralSettings | null = null;
  impresos: ImpresoWithCost[] = [];
  loadingImpresos = true;
  savingPaper = false;
  message = '';

  private readonly groupOrder: { type: PaperType; label: string }[] = [
    { type: PaperType.DTF, label: 'DTF' },
    { type: PaperType.DTF_UV, label: 'DTF UV' },
    { type: PaperType.SUBLIMACION, label: 'Sublimación' },
  ];

  ngOnInit(): void {
    this.settingsSub = this.settingsService.watchGeneralSettings().subscribe((settings) => {
      if (!settings || this.savingPaper) return;
      this.settings = structuredClone(settings);
    });
    this.settingsService.getGeneralSettings(false).subscribe();
    this.loadImpresos();
  }

  ngOnDestroy(): void {
    this.settingsSub?.unsubscribe();
  }

  get paperGroups(): PaperGroup[] {
    return this.groupOrder.map(({ type, label }) => ({
      type,
      label,
      items: this.impresos
        .filter((item) => item.paperType === type)
        .sort((a, b) => a.name.localeCompare(b.name, 'es')),
    }));
  }

  loadImpresos(): void {
    this.loadingImpresos = true;
    this.impresosService.getImpresos().subscribe({
      next: (items) => {
        this.impresos = items;
        this.loadingImpresos = false;
      },
      error: () => {
        this.loadingImpresos = false;
      },
    });
  }

  savePaperPrices(): void {
    if (!this.settings) return;
    this.savingPaper = true;
    this.message = '';
    this.settingsService
      .updatePaperPrices(this.settings.paperPricesPerSqm)
      .subscribe({
        next: (prices) => {
          if (this.settings) {
            this.settings = {
              ...this.settings,
              paperPricesPerSqm: prices,
            };
          }
          this.savingPaper = false;
          this.message = 'Precios del papel guardados';
          this.loadImpresos();
        },
        error: () => {
          this.savingPaper = false;
          this.message = 'Error al guardar precios del papel';
        },
      });
  }

  openCreate(): void {
    this.formDialogs.openImpreso().subscribe((saved) => {
      if (saved) {
        this.loadImpresos();
        this.message = 'Impreso creado';
      }
    });
  }

  openEdit(item: ImpresoWithCost): void {
    this.formDialogs.openImpreso(item).subscribe((saved) => {
      if (saved) {
        this.loadImpresos();
        this.message = 'Impreso actualizado';
      }
    });
  }

  deleteImpreso(item: ImpresoWithCost): void {
    if (!confirm(`¿Eliminar "${item.name}"?`)) return;
    this.impresosService.deleteImpreso(item.id).subscribe(() => {
      this.loadImpresos();
      this.message = 'Impreso eliminado';
    });
  }

  formatDimensions(item: ImpresoWithCost): string {
    return formatPrintDimensionsCm(
      item.widthCm,
      item.lengthCm,
      item.heightCm,
    );
  }
}
