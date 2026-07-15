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
  FilamentPriceConfig,
  FilamentType,
  ResinPriceConfig,
  ResinType,
  Supply,
  SupplyCategory,
  SupplyType,
} from '../../../core/models';
import {
  SettingsService,
  SuppliesService,
} from '../../../core/services/settings.service';
import {
  filamentTypeOptions,
  inferSupplyCategory,
  resinTypeOptions,
  supplyCategoryOptions,
  supplyTypeOptionsForCategory,
  supplyTypesForCategory,
} from '../../../shared/utils/select-options';

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
  ],
  templateUrl: './supply-form.component.html',
  styleUrl: './supply-form.component.scss',
})
export class SupplyFormComponent implements OnInit, OnChanges {
  private readonly suppliesService = inject(SuppliesService);
  private readonly settingsService = inject(SettingsService);

  @Input() supply: Supply | null = null;
  @Input() defaultCategory?: SupplyCategory;
  @Input() loading = false;
  @Input() error = '';
  @Output() save = new EventEmitter<Partial<Supply>>();
  @Output() cancel = new EventEmitter<void>();

  readonly supplyCategoryOptions = supplyCategoryOptions();
  readonly filamentTypeOptions = filamentTypeOptions();
  readonly resinTypeOptions = resinTypeOptions();

  filamentPrices: FilamentPriceConfig[] = [];
  resinPrices: ResinPriceConfig[] = [];
  settingsLoading = true;

  name = '';
  category = SupplyCategory.FDM;
  type = SupplyType.FILAMENTO;
  filamentType = FilamentType.PLA;
  resinType = ResinType.ESTANDAR;
  brand = '';
  unit = 'kg';
  quantity = 0;
  minStock = 0;
  unitPrice = 0;
  priceFromSettings = false;
  supplier = '';
  priceEditable = true;
  configError = '';

  get filteredSupplyTypeOptions() {
    return supplyTypeOptionsForCategory(this.category);
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
    return this.type === SupplyType.FILAMENTO;
  }

  get isResin(): boolean {
    return this.type === SupplyType.RESINA;
  }

  get needsMaterialType(): boolean {
    return this.isFilament || this.isResin;
  }

  onCategoryChange(): void {
    const allowed = supplyTypesForCategory(this.category);
    if (!allowed.includes(this.type)) {
      this.type = allowed[0];
    }
    this.onTypeChange();
  }

  onTypeChange(): void {
    this.category = inferSupplyCategory(this.type);
    this.setDefaultUnit();
    this.brand = '';
    this.unitPrice = 0;
    this.priceFromSettings = false;
    this.configError = '';
    this.syncPriceEditable();
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

  onSubmit(): void {
    this.configError = '';
    if (this.needsMaterialType && !this.priceFromSettings) {
      this.configError = this.isFilament
        ? 'Seleccioná una marca de la lista de Ajustes → Filamentos.'
        : 'Seleccioná una marca de la lista de Ajustes → Resinas.';
      return;
    }

    const payload: Partial<Supply> = {
      name: this.name.trim(),
      category: this.category,
      type: this.type,
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
    }
    this.save.emit(payload);
  }

  private loadPriceLists(): void {
    this.settingsLoading = true;
    this.settingsService.getGeneralSettings().subscribe({
      next: (settings) => {
        this.filamentPrices = settings.filamentPrices ?? [];
        this.resinPrices = settings.resinPrices ?? [];
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
      this.category = this.supply.category ?? inferSupplyCategory(this.supply.type);
      this.type = this.supply.type;
      this.filamentType = this.supply.filamentType ?? FilamentType.PLA;
      this.resinType = this.supply.resinType ?? ResinType.ESTANDAR;
      this.brand = this.supply.brand ?? '';
      this.unit = this.supply.unit;
      this.quantity = this.supply.quantity;
      this.minStock = this.supply.minStock;
      this.unitPrice = this.supply.unitPrice;
      this.priceFromSettings = this.supply.priceFromSettings;
      this.supplier = this.supply.supplier ?? '';
      this.applyConfiguredPrice();
    } else {
      this.name = '';
      this.category = this.defaultCategory ?? SupplyCategory.FDM;
      this.type = supplyTypesForCategory(this.category)[0];
      this.filamentType = FilamentType.PLA;
      this.resinType = ResinType.ESTANDAR;
      this.brand = '';
      this.quantity = 0;
      this.minStock = 0;
      this.unitPrice = 0;
      this.priceFromSettings = false;
      this.supplier = '';
      this.configError = '';
      this.syncPriceEditable();
      this.setDefaultUnit();
    }
  }

  private syncPriceEditable(): void {
    if (this.isFilament || this.isResin) {
      this.priceEditable = !this.priceFromSettings;
      return;
    }
    this.priceEditable = true;
  }

  private setDefaultUnit(): void {
    const units: Record<SupplyType, string> = {
      [SupplyType.FILAMENTO]: 'kg',
      [SupplyType.RESINA]: 'L',
      [SupplyType.ALCOHOL]: 'L',
      [SupplyType.TINTA]: 'ml',
      [SupplyType.REMERA]: 'unidad',
      [SupplyType.TAZA]: 'unidad',
      [SupplyType.BUZO]: 'unidad',
      [SupplyType.GORRA]: 'unidad',
      [SupplyType.FILM]: 'hoja',
      [SupplyType.VINILO]: 'm',
      [SupplyType.OTRO]: 'unidad',
    };
    this.unit = units[this.type];
  }

  private formatArs(value: number): string {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0,
    }).format(value);
  }
}
