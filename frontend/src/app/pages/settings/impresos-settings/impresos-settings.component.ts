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
import { BreakpointService } from '../../../core/services/breakpoint.service';
import { PAPER_TYPE_LABELS } from '../../../shared/constants/labels';
import { CurrencyArsPipe } from '../../../shared/pipes/labels.pipe';
import { formatPrintDimensionsCm } from '../../../shared/utils/estampado.helpers';
import { pricePerSqmFromReferenceSheet } from '../../../shared/utils/paper-cost.util';
import { FormDialogService } from '../../../modals/public-api';
import {
  DbButtonComponent,
  DbInputComponent,
  DbPillGroupComponent,
  DbStateMessageComponent,
  MobileCatalogRowComponent,
  MobileSettingsPageComponent,
  MobileFieldGroupComponent,
  DB_DATA_TABLE,
  OdlActionEvent,
  OdlColumn,
  OdlRowAction,
} from '@general-components';
import { MobileDockAction } from '../../../components/mobile-dock/mobile-dock.component';

interface PaperSheetGroup {
  key: keyof GeneralSettings['paperReferenceSheets'];
  label: string;
}

@Component({
  selector: 'app-impresos-settings',
  standalone: true,
  imports: [
    FormsModule,
    DbButtonComponent,
    DbInputComponent,
    DbPillGroupComponent,
    DbStateMessageComponent,
            CurrencyArsPipe,
    ...DB_DATA_TABLE,
    MobileSettingsPageComponent,
    MobileCatalogRowComponent,
    MobileFieldGroupComponent,
  ],
  templateUrl: './impresos-settings.component.html',
  styleUrl: './impresos-settings.component.scss',
})
export class ImpresosSettingsComponent implements OnInit, OnDestroy {
  private readonly settingsService = inject(SettingsService);
  private readonly impresosService = inject(ImpresosService);
  private readonly formDialogs = inject(FormDialogService);
  private readonly breakpoint = inject(BreakpointService);
  private settingsSub?: Subscription;

  readonly isMobile = this.breakpoint.isMobile;

  settings: GeneralSettings | null = null;
  impresos: ImpresoWithCost[] = [];
  loadingImpresos = true;
  savingPaper = false;
  message = '';
  search = '';
  techniqueFilter: PaperType | 'all' = 'all';
  readonly impresoActions: OdlRowAction<ImpresoWithCost>[] = [
    { id: 'editar', label: 'Editar' },
    { id: 'eliminar', label: 'Eliminar', danger: true },
  ];

  readonly impresoColumns: OdlColumn<ImpresoWithCost>[] = [
    { key: 'name', header: 'Impreso', type: 'primary' },
    {
      key: 'paperType',
      header: 'Técnica',
      value: (item) => PAPER_TYPE_LABELS[item.paperType] ?? item.paperType,
    },
    { key: 'size', header: 'Tamaño', value: (item) => this.formatDimensions(item) },
    { key: 'areaSqm', header: 'Área', value: (item) => this.formatArea(item.areaSqm) },
    { key: 'paperCost', header: 'Costo papel', type: 'money' },
  ];

  onImpresoAction(event: OdlActionEvent<ImpresoWithCost>): void {
    if (event.actionId === 'editar') this.openEdit(event.row);
    if (event.actionId === 'eliminar') this.deleteImpreso(event.row);
  }

  readonly groupOrder: { type: PaperType; label: string }[] = [
    { type: PaperType.DTF, label: 'DTF' },
    { type: PaperType.DTF_UV, label: 'DTF UV' },
    { type: PaperType.SUBLIMACION, label: 'Sublimación' },
  ];

  readonly paperSheetGroups: PaperSheetGroup[] = [
    { key: 'dtf', label: 'DTF' },
    { key: 'dtfUv', label: 'DTF UV' },
    { key: 'sublimacion', label: 'Sublimación' },
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

  get mobileDockActions(): MobileDockAction[] {
    return [
      {
        id: 'save',
        label: this.savingPaper ? 'Guardando…' : 'Guardar pliegos',
        kind: 'primary',
        disabled: this.savingPaper,
      },
    ];
  }

  onMobileDockAction(id: string): void {
    if (id === 'save') {
      this.savePaperPrices();
    }
  }

  savePaperPrices(): void {
    if (!this.settings) return;
    this.savingPaper = true;
    this.message = '';
    this.settingsService
      .updatePaperReferenceSheets(this.settings.paperReferenceSheets)
      .subscribe({
        next: (sheets) => {
          if (this.settings) {
            this.settings = {
              ...this.settings,
              paperReferenceSheets: sheets,
            };
          }
          this.savingPaper = false;
          this.message = 'Pliegos de referencia guardados';
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

  get visibleImpresos(): ImpresoWithCost[] {
    const query = this.search.trim().toLowerCase();
    return this.impresos
      .filter((item) => {
        const matchesTechnique =
          this.techniqueFilter === 'all' || item.paperType === this.techniqueFilter;
        const matchesSearch = !query || item.name.toLowerCase().includes(query);
        return matchesTechnique && matchesSearch;
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }

  get techniqueOptions(): { value: PaperType | 'all'; label: string }[] {
    return [
      { value: 'all', label: 'Todas' },
      ...this.groupOrder.map((group) => ({ value: group.type, label: group.label })),
    ];
  }

  setTechnique(filter: PaperType | 'all'): void {
    this.techniqueFilter = filter;
  }

  formatArea(value: number): string {
    return `${new Intl.NumberFormat('es-AR', {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    }).format(value)} m²`;
  }

  pricePerSqm(key: keyof GeneralSettings['paperReferenceSheets']): number {
    if (!this.settings) return 0;
    return pricePerSqmFromReferenceSheet(this.settings.paperReferenceSheets[key]);
  }

  formatDimensions(item: ImpresoWithCost): string {
    return formatPrintDimensionsCm(
      item.widthCm,
      item.lengthCm && item.lengthCm > 0 ? item.lengthCm : item.heightCm,
    );
  }

  /** Vista con coma decimal rioplatense («29,7 cm»). */
  formatCm(value: number): string {
    const n = Number(value) || 0;
    return `${new Intl.NumberFormat('es-AR', {
      maximumFractionDigits: 2,
    }).format(n)} cm`;
  }

  get mobileImpresoGroups(): { type: PaperType; label: string; items: ImpresoWithCost[] }[] {
    return this.groupOrder.map((group) => ({
      ...group,
      items: this.impresos
        .filter((item) => item.paperType === group.type)
        .sort((a, b) => a.name.localeCompare(b.name, 'es')),
    }));
  }

  formatCostPerCm2(item: ImpresoWithCost): string {
    const areaCm2 = (item.areaSqm || 0) * 10000;
    const value = areaCm2 > 0 ? item.paperCost / areaCm2 : 0;
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }
}
