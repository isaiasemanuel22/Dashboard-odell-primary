import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  HostListener,
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
  FilamentTypeConfig,
  ResinPriceConfig,
  ResinType,
  ResinTypeConfig,
  Supplier,
  Supply,
  SupplyCategory,
} from '../../../core/models';
import { SettingsService } from '../../../core/services/settings.service';
import { SuppliersService } from '../../../core/services/suppliers.service';
import { FormDialogService } from '../../../modals/form-dialog.service';
import { supplyCategoryOptions } from '../../../shared/utils/select-options';
import { buildFilamentTypeOptions } from '../../../shared/utils/filament-type.util';
import { buildResinTypeOptions } from '../../../shared/utils/resin-type.util';
import {
  defaultSupplyUnit,
  supplyUnitOptions,
} from '../../../shared/utils/supply-unit.util';
import { SupplyFormMaterialComponent } from './supply-form-material/supply-form-material.component';

const NEW_SUPPLIER_VALUE = '__new_supplier__';

/** Hasta 3 decimales para el input de stock (evita 12.700000000000001). */
export function roundStockInput(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const rounded = Math.round(value * 1e3) / 1e3;
  return Math.abs(rounded) < 1e-9 ? 0 : rounded;
}

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
  private readonly suppliersService = inject(SuppliersService);
  private readonly formDialogs = inject(FormDialogService);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input() supply: Supply | null = null;
  @Input() defaultCategory?: SupplyCategory;
  @Input() loading = false;
  @Input() error = '';
  /** En mobile el pie vive en `db-mobile-form-shell` / dock. */
  @Input() hideFooter = false;
  @Output() save = new EventEmitter<Partial<Supply>>();
  @Output() cancel = new EventEmitter<void>();

  readonly supplyCategoryOptions = supplyCategoryOptions();

  filamentPrices: FilamentPriceConfig[] = [];
  resinPrices: ResinPriceConfig[] = [];
  filamentTypes: FilamentTypeConfig[] = [];
  resinTypes: ResinTypeConfig[] = [];
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
  supplierId = '';
  spoolGrams = 1000;
  suppliers: Supplier[] = [];
  priceEditable = true;
  configError = '';
  private userEdited = false;

  get supplierOptions(): DbSelectOption[] {
    return [
      { value: '', label: 'Sin proveedor' },
      ...this.suppliers.map((supplier) => ({
        value: supplier.id,
        label: supplier.name,
      })),
      { value: NEW_SUPPLIER_VALUE, label: '+ Nuevo proveedor' },
    ];
  }

  hasUnsavedChanges(): boolean {
    return this.userEdited;
  }

  @HostListener('input')
  @HostListener('change')
  onFormFieldEdit(): void {
    this.userEdited = true;
  }

  @HostListener('click', ['$event'])
  onFormClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (target.closest('[data-discard-safe]')) return;
    if (
      target.closest(
        'button, [role="button"], input, select, textarea, .db-seg__btn',
      )
    ) {
      this.userEdited = true;
    }
  }

  get submitMissing(): string[] {
    const missing: string[] = [];
    if (!this.name.trim()) missing.push('nombre');
    if ((this.isFilament || this.isResin) && !this.brand.trim()) {
      missing.push('marca');
    }
    if (this.showColorField && !this.colorId) missing.push('color');
    return missing;
  }

  get submitMissingLabel(): string {
    const items = this.submitMissing;
    if (!items.length) return '';
    return items.length === 1
      ? `Falta: ${items[0]}`
      : `Faltan: ${items.join(', ')}`;
  }

  get canSubmit(): boolean {
    return !this.loading && this.submitMissing.length === 0;
  }

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
        // Lista de Ajustes es referencia; el precio del insumo va en el campo de abajo.
        label: `${entry.brand} · lista Ajustes ${this.formatArs(entry.pricePerKg)}/kg`,
      }));
  }

  get resinBrandOptions(): DbSelectOption[] {
    return this.resinPrices
      .filter((entry) => entry.resinType === this.resinType)
      .map((entry) => ({
        value: entry.brand,
        label: `${entry.brand} · lista Ajustes ${this.formatArs(entry.pricePerLiter)}/L`,
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
    if (this.isFilament || this.isResin) {
      if (this.priceFromSettings) {
        return 'Precio del insumo (lista de Ajustes). Si comprás a otro valor, deja de usar Ajustes.';
      }
      if (this.supply) {
        return 'Precio del insumo (queda de la última compra o carga manual; la lista de Ajustes es solo referencia en la marca).';
      }
      if (this.isFilament && !this.filamentBrandOptions.length) {
        return 'No hay marcas cargadas para este tipo. Agregalas en Ajustes → Filamentos.';
      }
      if (this.isResin && !this.resinBrandOptions.length) {
        return 'No hay marcas cargadas para este tipo. Agregalas en Ajustes → Resinas.';
      }
      return 'Elegí marca: se completa con el precio de lista de Ajustes.';
    }
    return 'Precio del insumo — manual, independiente de marca';
  }

  ngOnInit(): void {
    this.loadPriceLists();
    this.loadSuppliers();
  }

  onSupplierChange(value: string): void {
    if (value === NEW_SUPPLIER_VALUE) {
      // El CVA del select ya dejó `__new_supplier__` en su value interno;
      // NgModel no siempre reescribe si el padre “corrige” en el mismo tick.
      const previousId = this.supplierId;
      this.setSupplierId(previousId);
      this.formDialogs.openSupplier(null).subscribe((created) => {
        if (!created) {
          this.setSupplierId(previousId);
          return;
        }
        this.applyCreatedSupplier(created);
      });
      return;
    }
    this.supplierId = value;
  }

  /** Expone el flujo post-diálogo para el spec (lista local + id + CD). */
  applyCreatedSupplier(created: Supplier): void {
    const exists = this.suppliers.some((s) => s.id === created.id);
    this.suppliers = exists
      ? this.suppliers.map((s) => (s.id === created.id ? created : s))
      : [...this.suppliers, created].sort((a, b) =>
          a.name.localeCompare(b.name, 'es'),
        );
    this.setSupplierId(created.id);
    this.userEdited = true;
    // Refresco en background; no pisar la selección si la lista llega tarde.
    this.suppliersService.list().subscribe({
      next: (items) => {
        this.suppliers = items;
        if (!items.some((s) => s.id === created.id)) {
          this.suppliers = [...items, created].sort((a, b) =>
            a.name.localeCompare(b.name, 'es'),
          );
        }
        this.setSupplierId(created.id);
      },
      error: () => {
        /* ya quedó la lista local */
      },
    });
  }

  private setSupplierId(id: string): void {
    this.supplierId = id;
    this.cdr.detectChanges();
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

  get unitOptions(): DbSelectOption[] {
    return supplyUnitOptions(this.unit).map((option) => ({
      value: option.value,
      label: option.label,
    }));
  }

  onCategoryChange(): void {
    this.onCategoryFieldsChange();
  }

  onFilamentTypeChange(): void {
    this.brand = '';
    this.applyConfiguredPrice({ fromUserBrandChange: true });
  }

  onResinTypeChange(): void {
    this.brand = '';
    this.applyConfiguredPrice({ fromUserBrandChange: true });
  }

  onBrandChange(): void {
    this.applyConfiguredPrice({ fromUserBrandChange: true });
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
      supplierId: this.supplierId || undefined,
      supplier: this.suppliers.find((s) => s.id === this.supplierId)?.name,
    };
    if (this.isFilament) {
      payload.filamentType = this.filamentType;
      payload.brand = this.brand.trim();
      const grams = Math.trunc(Number(this.spoolGrams));
      payload.spoolGrams = Number.isFinite(grams) && grams > 0 ? grams : 1000;
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
        this.settingsLoading = false;
        // Al editar, no pisar el precio guardado del insumo con la lista de Ajustes.
        if (!this.supply) {
          this.applyConfiguredPrice({ fromUserBrandChange: true });
        } else {
          this.syncPriceEditable();
        }
      },
      error: () => {
        this.settingsLoading = false;
      },
    });
  }

  /**
   * Aplica el precio de lista de Ajustes.
   * Solo al crear o cuando el usuario cambia marca/tipo — no al abrir un insumo
   * existente (el unitPrice guardado puede venir de una compra).
   */
  private applyConfiguredPrice(
    options: { fromUserBrandChange?: boolean } = {},
  ): void {
    this.configError = '';
    const allowOverwrite = options.fromUserBrandChange === true || !this.supply;

    if (this.isFilament) {
      const match = this.filamentPrices.find(
        (entry) =>
          entry.materialType === this.filamentType &&
          entry.brand.toLowerCase() === this.brand.trim().toLowerCase(),
      );
      if (match) {
        if (allowOverwrite) {
          this.unitPrice = match.pricePerKg;
          this.priceFromSettings = true;
        }
        this.unit = 'kg';
      } else if (allowOverwrite) {
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
        if (allowOverwrite) {
          this.unitPrice = match.pricePerLiter;
          this.priceFromSettings = true;
        }
        this.unit = 'L';
      } else if (allowOverwrite) {
        this.unitPrice = 0;
        this.priceFromSettings = false;
      }
      this.syncPriceEditable();
    }
  }

  private resetForm(): void {
    this.userEdited = false;
    if (this.supply) {
      this.name = this.supply.name;
      this.category = this.supply.category;
      this.filamentType = this.supply.filamentType ?? FilamentType.PLA;
      this.resinType = this.supply.resinType ?? ResinType.ESTANDAR;
      this.brand = this.supply.brand ?? '';
      this.unit = this.supply.unit;
      this.quantity = roundStockInput(this.supply.quantity);
      this.minStock = roundStockInput(this.supply.minStock);
      this.unitPrice = this.supply.unitPrice;
      this.priceFromSettings = this.supply.priceFromSettings;
      this.supplierId = this.supply.supplierId ?? '';
      this.spoolGrams = this.supply.spoolGrams ?? 1000;
      this.colorId = this.supply.colorId ?? '';
      this.syncPriceEditable();
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
      this.supplierId = '';
      this.spoolGrams = 1000;
      this.colorId = '';
      this.configError = '';
      this.syncPriceEditable();
      this.setDefaultUnit();
    }
  }

  private loadSuppliers(): void {
    this.suppliersService.list().subscribe({
      next: (items) => {
        this.suppliers = items;
      },
    });
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
