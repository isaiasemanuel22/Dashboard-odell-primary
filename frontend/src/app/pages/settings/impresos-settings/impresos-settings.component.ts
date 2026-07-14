import {
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  GeneralSettings,
  ImpresoWithCost,
  PaperType,
} from '../../../core/models';
import { ImpresosService } from '../../../core/services/impresos.service';
import { SettingsService } from '../../../core/services/settings.service';
import { CurrencyArsPipe } from '../../../shared/pipes/labels.pipe';
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
export class ImpresosSettingsComponent implements OnInit {
  private readonly settingsService = inject(SettingsService);
  private readonly impresosService = inject(ImpresosService);
  private readonly formDialogs = inject(FormDialogService);

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
    this.loadSettings();
    this.loadImpresos();
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

  loadSettings(): void {
    this.settingsService.getGeneralSettings().subscribe((s) => {
      this.settings = structuredClone(s);
    });
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
      .updateGeneralSettings({
        paperPricesPerSqm: this.settings.paperPricesPerSqm,
      })
      .subscribe({
        next: (s) => {
          this.settings = structuredClone(s);
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
    return `${item.widthCm} × ${item.heightCm} cm`;
  }
}
