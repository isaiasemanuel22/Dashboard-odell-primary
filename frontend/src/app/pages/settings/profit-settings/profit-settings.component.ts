import { RouterLink } from '@angular/router';
import { CurrencyArsPipe } from '../../../shared/pipes/labels.pipe';
import {
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import {
  GeneralSettings,
  ServiceProfitMargins,
  ServiceType,
  WholesaleDiscountSettings,
} from '../../../core/models';
import { SettingsService } from '../../../core/services/settings.service';
import { BreakpointService } from '../../../core/services/breakpoint.service';
import { SERVICE_TYPE_LABELS } from '../../../shared/constants/labels';
import { normalizeProfitMargins } from '../../../shared/utils/pricing.util';
import {
  WHOLESALE_EXAMPLE_COST,
  WholesaleAreaExampleRow,
  WholesaleCorrectExample,
  WholesaleWrongExample,
  buildWholesaleAreaRows,
  buildWholesaleCorrectExample,
  buildWholesaleWrongExample,
  normalizeWholesaleDiscount,
  wholesaleBreakEvenMarginPercent,
} from '../../../shared/utils/wholesale-example.util';
import {
  DbButtonComponent,
  DbCheckboxComponent,
  DbCheckboxGroupComponent,
  DbInputComponent,
  DbStateMessageComponent,
  MobileSettingsPageComponent,
  MobileToggleRowComponent,
  MobileFieldGroupComponent,
  DB_DATA_TABLE,
  OdlColumn,
  serviceTag,
} from '@general-components';
import { MobileDockAction } from '../../../components/mobile-dock/mobile-dock.component';
import {
  SettingsUnsavedChanges,
  settingsSnapshot,
} from '../settings-unsaved-changes';

interface MarginField {
  service: ServiceType;
  label: string;
  appliesTo: string;
}

@Component({
  selector: 'app-profit-settings',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    CurrencyArsPipe,
    DbStateMessageComponent,
    DbButtonComponent,
    DbCheckboxComponent,
    DbCheckboxGroupComponent,
    DbInputComponent,
    MobileSettingsPageComponent,
    MobileToggleRowComponent,
    MobileFieldGroupComponent,
    ...DB_DATA_TABLE,
  ],
  templateUrl: './profit-settings.component.html',
  styleUrl: './profit-settings.component.scss',
})
export class ProfitSettingsComponent
  implements OnInit, OnDestroy, SettingsUnsavedChanges
{
  private readonly settingsService = inject(SettingsService);
  private readonly breakpoint = inject(BreakpointService);
  private readonly cdr = inject(ChangeDetectorRef);
  private settingsSub?: Subscription;

  readonly isMobile = this.breakpoint.isMobile;

  settings: GeneralSettings | null = null;
  savingMargins = false;
  savingDiscount = false;
  marginsMessage = '';
  discountMessage = '';
  private savedSnapshot = '';

  readonly exampleCost = WHOLESALE_EXAMPLE_COST;

  readonly marginColumns: OdlColumn<MarginField>[] = [
    {
      key: 'area',
      header: 'Área',
      type: 'tags',
      tags: (field) => [serviceTag(field.service)],
    },
    {
      key: 'appliesTo',
      header: 'Se aplica a',
      value: (field) => field.appliesTo,
    },
    { key: 'margen', header: 'Margen', width: '140px' },
    { key: 'ejemplo', header: 'Ejemplo', align: 'end' },
  ];

  readonly areaExampleColumns: OdlColumn<WholesaleAreaExampleRow>[] = [
    {
      key: 'area',
      header: 'Área',
      type: 'tags',
      tags: (row) => [serviceTag(row.service)],
      secondary: (row) => (row.applies ? null : 'No aplica'),
    },
    {
      key: 'margen',
      header: 'Margen',
      align: 'end',
      value: (row) => `${row.marginPercent}%`,
    },
    { key: 'listPrice', header: 'Precio de lista', align: 'end' },
    { key: 'wholesalePrice', header: 'Precio mayorista', align: 'end' },
    { key: 'wholesaleProfit', header: 'Ganancia por mayor', align: 'end' },
  ];

  readonly marginFields: MarginField[] = [
    {
      service: ServiceType.IMPRESION_3D,
      label: SERVICE_TYPE_LABELS[ServiceType.IMPRESION_3D],
      appliesTo: 'Productos FDM y resina',
    },
    {
      service: ServiceType.ESTAMPADO,
      label: SERVICE_TYPE_LABELS[ServiceType.ESTAMPADO],
      appliesTo: 'Productos de estampado',
    },
    {
      service: ServiceType.DISENO_GRAFICO,
      label: SERVICE_TYPE_LABELS[ServiceType.DISENO_GRAFICO],
      appliesTo: 'Líneas de diseño gráfico en pedidos',
    },
    {
      service: ServiceType.MODELADO,
      label: SERVICE_TYPE_LABELS[ServiceType.MODELADO],
      appliesTo: 'Líneas de modelado en pedidos',
    },
  ];

  readonly areaOptions = this.marginFields.map((field) => ({
    service: field.service,
    label: field.label,
  }));

  ngOnInit(): void {
    this.settingsSub = this.settingsService
      .watchGeneralSettings()
      .subscribe((settings) => {
        if (!settings || this.savingMargins || this.savingDiscount) return;
        this.settings = {
          ...structuredClone(settings),
          profitMargins: normalizeProfitMargins(settings.profitMargins),
          wholesaleDiscount: normalizeWholesaleDiscount(
            settings.wholesaleDiscount,
          ),
        };
        this.captureBaseline();
        this.cdr.markForCheck();
      });
    this.settingsService.getGeneralSettings(false).subscribe();
  }

  ngOnDestroy(): void {
    this.settingsSub?.unsubscribe();
  }

  hasUnsavedChanges(): boolean {
    if (!this.settings) return false;
    return this.currentSnapshot() !== this.savedSnapshot;
  }

  private captureBaseline(): void {
    this.savedSnapshot = this.currentSnapshot();
  }

  private currentSnapshot(): string {
    if (!this.settings) return '';
    return settingsSnapshot({
      profitMargins: normalizeProfitMargins(this.settings.profitMargins),
      wholesaleDiscount: normalizeWholesaleDiscount(
        this.settings.wholesaleDiscount,
      ),
    });
  }

  get wholesale(): WholesaleDiscountSettings {
    return normalizeWholesaleDiscount(this.settings?.wholesaleDiscount);
  }

  get exampleService(): ServiceType {
    const selected = this.wholesale.serviceTypes;
    return selected[0] ?? ServiceType.IMPRESION_3D;
  }

  get exampleMarginPercent(): number {
    if (!this.settings) return 0;
    return this.marginValue(this.exampleService);
  }

  get correctExample(): WholesaleCorrectExample {
    return buildWholesaleCorrectExample(
      this.exampleCost,
      this.exampleMarginPercent,
      this.wholesale.percent,
    );
  }

  get wrongExample(): WholesaleWrongExample {
    return buildWholesaleWrongExample(
      this.exampleCost,
      this.exampleMarginPercent,
      this.wholesale.percent,
    );
  }

  get areaExampleRows(): WholesaleAreaExampleRow[] {
    if (!this.settings) return [];
    return buildWholesaleAreaRows(
      this.exampleCost,
      this.settings.profitMargins,
      this.wholesale,
      this.marginFields.map((field) => field.service),
    );
  }

  get breakEvenMarginPercent(): number {
    return wholesaleBreakEvenMarginPercent(this.wholesale.percent);
  }

  marginValue(service: ServiceType): number {
    if (!this.settings) return 0;
    return this.settings.profitMargins[service as keyof ServiceProfitMargins] ?? 0;
  }

  setMargin(service: ServiceType, value: number | string): void {
    if (!this.settings) return;
    const parsed = Number(value);
    this.settings = {
      ...this.settings,
      profitMargins: {
        ...this.settings.profitMargins,
        [service]: Number.isFinite(parsed) ? parsed : 0,
      },
    };
  }

  examplePrice(cost: number, margin: number): number {
    const markup = Math.min(Math.max(margin, 0), 999);
    if (cost <= 0) return 0;
    if (markup === 0) return cost;
    return Math.round(cost * (1 + markup / 100));
  }

  setWholesaleEnabled(enabled: boolean): void {
    this.patchWholesale({ enabled: !!enabled });
  }

  setWholesalePercent(value: number | string): void {
    const parsed = Number(value);
    this.patchWholesale({
      percent: Number.isFinite(parsed) ? parsed : 0,
    });
  }

  isAreaSelected(service: ServiceType): boolean {
    return this.wholesale.serviceTypes.includes(service);
  }

  setAreaSelected(service: ServiceType, selected: boolean): void {
    const current = new Set(this.wholesale.serviceTypes);
    if (selected) {
      current.add(service);
    } else {
      current.delete(service);
    }
    this.patchWholesale({ serviceTypes: [...current] });
  }

  mobileMarginHint(service: ServiceType): string {
    if (
      service === ServiceType.DISENO_GRAFICO ||
      service === ServiceType.MODELADO
    ) {
      return 'Sobre la tarifa por hora';
    }
    const price = this.examplePrice(1000, this.marginValue(service));
    const money = new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0,
    }).format(price);
    return `Costo $ 1.000 → precio ${money}`;
  }

  get mobileDockActions(): MobileDockAction[] {
    const saving = this.savingMargins || this.savingDiscount;
    return [
      {
        id: 'save',
        label: saving ? 'Guardando…' : 'Guardar',
        kind: 'primary',
        disabled: saving,
      },
    ];
  }

  onMobileDockAction(id: string): void {
    if (id === 'save') {
      this.saveAllMobile();
    }
  }

  saveAllMobile(): void {
    this.saveMargins();
    this.saveDiscount();
  }

  saveMargins(): void {
    if (!this.settings) return;

    const profitMargins = normalizeProfitMargins(this.settings.profitMargins);
    this.settings.profitMargins = profitMargins;

    for (const field of this.marginFields) {
      const value = profitMargins[field.service as keyof ServiceProfitMargins] ?? 0;
      if (value < 0 || value > 999) {
        this.marginsMessage = `El margen de ${field.label} debe estar entre 0 y 999 %`;
        return;
      }
    }

    this.savingMargins = true;
    this.marginsMessage = '';

    this.settingsService.updateProfitMargins(profitMargins).subscribe({
      next: (saved) => {
        if (this.settings) {
          this.settings = {
            ...this.settings,
            profitMargins: saved,
          };
        }
        this.savingMargins = false;
        this.captureBaseline();
        this.marginsMessage = 'Márgenes guardados correctamente';
        this.cdr.markForCheck();
      },
      error: () => {
        this.savingMargins = false;
        this.marginsMessage = 'Error al guardar los márgenes';
        this.cdr.markForCheck();
      },
    });
  }

  saveDiscount(): void {
    if (!this.settings) return;

    const wholesaleDiscount = normalizeWholesaleDiscount(
      this.settings.wholesaleDiscount,
    );
    const percent = Number(wholesaleDiscount.percent);

    if (!Number.isFinite(percent) || percent < 0 || percent > 99) {
      this.discountMessage = 'El descuento debe estar entre 0 y 99 %';
      return;
    }

    wholesaleDiscount.percent = percent;
    this.settings.wholesaleDiscount = wholesaleDiscount;
    this.savingDiscount = true;
    this.discountMessage = '';

    this.settingsService.updateWholesaleDiscount(wholesaleDiscount).subscribe({
      next: (saved) => {
        if (this.settings) {
          this.settings = {
            ...this.settings,
            wholesaleDiscount: normalizeWholesaleDiscount(saved),
          };
        }
        this.savingDiscount = false;
        this.captureBaseline();
        this.discountMessage = 'Descuento por mayor guardado correctamente';
        this.cdr.markForCheck();
      },
      error: () => {
        this.savingDiscount = false;
        this.discountMessage = 'Error al guardar el descuento por mayor';
        this.cdr.markForCheck();
      },
    });
  }

  private patchWholesale(
    partial: Partial<WholesaleDiscountSettings>,
  ): void {
    if (!this.settings) return;
    const current = normalizeWholesaleDiscount(this.settings.wholesaleDiscount);
    this.settings = {
      ...this.settings,
      wholesaleDiscount: {
        ...current,
        ...partial,
        serviceTypes: partial.serviceTypes
          ? [...partial.serviceTypes]
          : [...current.serviceTypes],
      },
    };
  }
}
