import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  DbFormComponent,
  DbFormErrorComponent,
  DbFormFooterComponent,
  DbFormGridComponent,
  DbInputComponent,
  DbSelectComponent,
  DbButtonComponent,
  DbSelectOption,
} from '@general-components';
import {
  ColorConfig,
  FilamentPriceConfig,
  FilamentType,
  FilamentTypeConfig,
  ResinPriceConfig,
  ResinType,
  ResinTypeConfig,
  Supply,
  SupplyCategory,
} from '../../../core/models';
import { SettingsService } from '../../../core/services/settings.service';
import { supplyCategoryOptions } from '../../../shared/utils/select-options';
import { buildFilamentTypeOptions } from '../../../shared/utils/filament-type.util';
import { buildResinTypeOptions } from '../../../shared/utils/resin-type.util';
import {
  defaultSupplyUnit,
  supplyUnitOptions,
} from '../../../shared/utils/supply-unit.util';
import { SupplyFormMaterialComponent } from './supply-form-material/supply-form-material.component';

@Component({
  selector: 'app-supply-form',
  standalone: true,
  imports: [
    FormsModule,
    DbFormComponent,
    DbSelectComponent,
    DbInputComponent,
    DbFormGridComponent,
    DbFormErrorComponent,
    DbFormFooterComponent,
    DbButtonComponent,
    SupplyFormMaterialComponent,
  ],
  templateUrl: './supply-form.component.html',
  styleUrl: './supply-form.component.scss',
})
export class SupplyFormComponent implements OnInit, OnChanges {
  private readonly settingsService = inject(SettingsService);

  @Input() supply: Supply | null = null;
  @Input() defaultCategory?: SupplyCategory;
  @Input() loading = false;
  @Input() error = '';
  @Output() save = new EventEmitter<Partial<Supply>>();
  @Output() cancel = new EventEmitter<void>();

  readonly supplyCategoryOptions = supplyCategoryOptions();

  filamentPrices: FilamentPriceConfig[] = [];
  resinPrices: ResinPriceConfig[] = [];
  filamentTypes: FilamentTypeConfig[] = [];
  resinTypes: ResinTypeConfig[] = [];
  colorCatalog: ColorConfig[] = [];
  settingsLoading = true;

  name = '';
  category = SupplyCategory.FDM;
  filamentType = FilamentType.PLA;
  resinType: ResinType | string = ResinType.ESTANDAR;
  brand = '';
  colorId = '';
  unit = 'kg';
  quantity = 0;
  minStock = 0;
  unitPrice = 0;
  priceFromSettings = false;
  supplier = '';
  priceEditable = true;
  configError = '';

  get filamentTypeOptions(): DbSelectOption[] {
    return buildFilamentTypeOptions(
      this.filamentTypes,
      this.filamentPrices,
      this.filamentType ? [this.filamentType] : [],
      'code',
    );
  }

  get resinTypeOptions(): DbSelectOption[] {
    return buildResinTypeOptions(
      this.resinTypes,
      this.resinPrices,
      this.resinType ? [this.resinType] : [],
      'code',
    );
  }

  get filamentBrandOptions(): DbSelectOption[] {
    return this.filamentPrices
      .filter((entry) => entry.materialType === this.filamentType)
      .map((entry) => ({
        value: entry.brand,
        label: `${entry.brand} — ${this.formatArs(entry.pricePerKg)}/kg`,
      }));
  }

  get resinBrandOptions(): DbSelectOption[] {
    return this.resinPrices
      .filter((entry) => entry.resinType === this.resinType)
      .map((entry) => ({
        value: entry.brand,
        label: `${entry.brand} — ${this.formatArs(entry.pricePerLiter)}/L`,
      }));
  }

  get unitHint(): string {
    if (!this.priceFromSettings) return '';
    return this.isFilament
      ? 'Fija en kg: el precio de Ajustes es por kilogramo.'
      : 'Fija en L: el precio de Ajustes es por litro.';
  }

  get priceHint(): string {
    if (this.settingsLoading) return 'Cargando listas de precios...';
    if (this.isFilament && this.priceFromSettings) {
      return 'Precio desde Ajustes → Filamentos. Para cambiarlo, editá la lista de precios por marca.';
    }
    if (this.isFilament && !this.filamentBrandOptions.length) {
      return 'No hay marcas cargadas para este tipo. Agregalas en Ajustes → Filamentos.';
    }
    if (this.isFilament) {
      return 'Elegí marca y tipo desde la lista configurada en Ajustes.';
    }
    if (this.isResin && this.priceFromSettings) {
      return 'Precio desde Ajustes → Resinas. Para cambiarlo, editá la lista de precios por marca.';
    }
    if (this.isResin && !this.resinBrandOptions.length) {
      return 'No hay marcas cargadas para este tipo. Agregalas en Ajustes → Resinas.';
    }
    if (this.isResin) {
      return 'Elegí marca y tipo desde la lista configurada en Ajustes.';
    }
    return 'Precio manual — independiente de marca';
  }

  ngOnInit(): void {
    this.loadPriceLists();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['supply'] || changes['defaultCategory']) this.resetForm();
  }

  get isFilament(): boolean {
    return this.category === SupplyCategory.FDM;
  }

  get isResin(): boolean {
    return this.category === SupplyCategory.RESINA;
  }

  get showColorField(): boolean {
    return (
      this.category === SupplyCategory.FDM ||
      this.category === SupplyCategory.RESINA ||
      this.category === SupplyCategory.ESTAMPADO
    );
  }

  get colorOptions(): DbSelectOption[] {
    return this.colorCatalog.map((color) => ({
      value: color.id,
      label: color.name,
    }));
  }

  get unitOptions(): DbSelectOption[] {
    return supplyUnitOptions(this.unit).map((option) => ({
      value: option.value,
      label: option.label,
    }));
  }

  get selectedColorHex(): string | undefined {
    return this.colorCatalog.find((color) => color.id === this.colorId)?.hex;
  }

  onCategoryChange(): void {
    this.onCategoryFieldsChange();
  }

  onFilamentTypeChange(): void {
    this.brand = '';
    this.applyConfiguredPrice();
  }

  onResinTypeChange(): void {
    this.brand = '';
    this.applyConfiguredPrice();
  }

  onBrandChange(): void {
    this.applyConfiguredPrice();
  }

  onMaterialBrandChange(value: string): void {
    this.brand = value;
    if (this.isFilament || this.isResin) {
      this.onBrandChange();
    }
  }

  onSubmit(): void {
    this.configError = '';

    const missing: string[] = [];
    if (!this.name.trim()) missing.push('nombre');
    if ((this.isFilament || this.isResin) && !this.brand.trim()) missing.push('marca');
    if (this.showColorField && !this.colorId) missing.push('color');
    if (Number(this.quantity) < 0) missing.push('una cantidad de 0 o más');
    if (missing.length) {
      this.configError = `Faltan: ${missing.join(', ')}.`;
      return;
    }

    if ((this.isFilament || this.isResin) && !this.priceFromSettings) {
      this.configError = this.isFilament
        ? 'Seleccioná una marca de la lista de Ajustes → Filamentos.'
        : 'Seleccioná una marca de la lista de Ajustes → Resinas.';
      return;
    }
    if (this.showColorField && !this.colorId) {
      this.configError = 'Seleccioná un color del catálogo (Ajustes → Colores).';
      return;
    }

    if (this.priceFromSettings) {
      this.unit = this.isFilament ? 'kg' : 'L';
    }

    const payload: Partial<Supply> = {
      name: this.name.trim(),
      category: this.category,
      unit: this.unit,
      quantity: Number(this.quantity),
      minStock: Number(this.minStock),
      unitPrice: Number(this.unitPrice),
      priceFromSettings: this.priceFromSettings,
      supplier: this.supplier.trim() || undefined,
    };
    if (this.isFilament) {
      payload.filamentType = this.filamentType;
      payload.brand = this.brand.trim();
    } else if (this.isResin) {
      payload.resinType = this.resinType;
      payload.brand = this.brand.trim();
    } else if (this.brand.trim()) {
      payload.brand = this.brand.trim();
    }
    if (this.showColorField) {
      payload.colorId = this.colorId;
    }
    this.save.emit(payload);
  }

  private loadPriceLists(): void {
    this.settingsLoading = true;
    this.settingsService.getGeneralSettings().subscribe({
      next: (settings) => {
        this.filamentPrices = settings.filamentPrices ?? [];
        this.resinPrices = settings.resinPrices ?? [];
        this.filamentTypes = settings.filamentTypes ?? [];
        this.resinTypes = settings.resinTypes ?? [];
        this.colorCatalog = settings.colors ?? [];
        this.settingsLoading = false;
        this.applyConfiguredPrice();
      },
      error: () => {
        this.settingsLoading = false;
      },
    });
  }

  private applyConfiguredPrice(): void {
    this.configError = '';

    if (this.isFilament) {
      const match = this.filamentPrices.find(
        (entry) =>
          entry.materialType === this.filamentType &&
          entry.brand.toLowerCase() === this.brand.trim().toLowerCase(),
      );
      if (match) {
        this.unitPrice = match.pricePerKg;
        this.unit = 'kg';
        this.priceFromSettings = true;
      } else {
        this.unitPrice = 0;
        this.priceFromSettings = false;
      }
      this.syncPriceEditable();
      return;
    }

    if (this.isResin) {
      const match = this.resinPrices.find(
        (entry) =>
          entry.resinType === this.resinType &&
          entry.brand.toLowerCase() === this.brand.trim().toLowerCase(),
      );
      if (match) {
        this.unitPrice = match.pricePerLiter;
        this.unit = 'L';
        this.priceFromSettings = true;
      } else {
        this.unitPrice = 0;
        this.priceFromSettings = false;
      }
      this.syncPriceEditable();
    }
  }

  private resetForm(): void {
    if (this.supply) {
      this.name = this.supply.name;
      this.category = this.supply.category;
      this.filamentType = this.supply.filamentType ?? FilamentType.PLA;
      this.resinType = this.supply.resinType ?? ResinType.ESTANDAR;
      this.brand = this.supply.brand ?? '';
      this.unit = this.supply.unit;
      this.quantity = this.supply.quantity;
      this.minStock = this.supply.minStock;
      this.unitPrice = this.supply.unitPrice;
      this.priceFromSettings = this.supply.priceFromSettings;
      this.supplier = this.supply.supplier ?? '';
      this.colorId = this.supply.colorId ?? '';
      this.applyConfiguredPrice();
    } else {
      this.name = '';
      this.category = this.defaultCategory ?? SupplyCategory.FDM;
      this.filamentType = FilamentType.PLA;
      this.resinType = ResinType.ESTANDAR;
      this.brand = '';
      this.quantity = 0;
      this.minStock = 0;
      this.unitPrice = 0;
      this.priceFromSettings = false;
      this.supplier = '';
      this.colorId = '';
      this.configError = '';
      this.syncPriceEditable();
      this.setDefaultUnit();
    }
  }

  private onCategoryFieldsChange(): void {
    this.setDefaultUnit();
    this.brand = '';
    this.colorId = '';
    this.unitPrice = 0;
    this.priceFromSettings = false;
    this.configError = '';
    this.syncPriceEditable();
  }

  private syncPriceEditable(): void {
    if (this.isFilament || this.isResin) {
      this.priceEditable = !this.priceFromSettings;
      return;
    }
    this.priceEditable = true;
  }

  private setDefaultUnit(): void {
    this.unit = defaultSupplyUnit(this.category);
  }

  private formatArs(value: number): string {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0,
    }).format(value);
  }
}
