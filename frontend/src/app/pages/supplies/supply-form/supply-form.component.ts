import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
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
} from '@general-components';
import {
  FilamentType,
  ResinType,
  Supply,
  SupplyType,
} from '../../../core/models';
import { SuppliesService } from '../../../core/services/settings.service';
import {
  filamentTypeOptions,
  resinTypeOptions,
  supplyTypeOptions,
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
export class SupplyFormComponent implements OnChanges {
  private readonly suppliesService = inject(SuppliesService);

  @Input() supply: Supply | null = null;
  @Input() loading = false;
  @Input() error = '';
  @Output() save = new EventEmitter<Partial<Supply>>();
  @Output() cancel = new EventEmitter<void>();

  readonly supplyTypeOptions = supplyTypeOptions();
  readonly filamentTypeOptions = filamentTypeOptions();
  readonly resinTypeOptions = resinTypeOptions();

  name = '';
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
  loadingPrice = false;

  get priceHint(): string {
    if (this.loadingPrice) return 'Cargando precio desde configuración...';
    if (this.priceFromSettings && this.needsMaterialType) {
      return 'Precio desde configuración (marca + tipo)';
    }
    if (!this.needsMaterialType) {
      return 'Precio manual — independiente de marca';
    }
    return '';
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['supply']) this.resetForm();
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

  onTypeChange(): void {
    this.setDefaultUnit();
    this.priceEditable = this.isFilament;
    if (this.needsMaterialType) {
      this.fetchDefaultPrice();
    } else {
      this.unitPrice = 0;
      this.priceFromSettings = false;
    }
  }

  onMaterialChange(): void {
    if (this.needsMaterialType) this.fetchDefaultPrice();
  }

  fetchDefaultPrice(): void {
    if (!this.brand.trim()) return;
    this.loadingPrice = true;
    this.suppliesService
      .getDefaultPrice({
        type: this.type,
        brand: this.brand.trim(),
        filamentType: this.isFilament ? this.filamentType : undefined,
        resinType: this.isResin ? this.resinType : undefined,
      })
      .subscribe({
        next: (result) => {
          this.loadingPrice = false;
          if (result) {
            this.unitPrice = result.unitPrice;
            this.unit = result.unit;
            this.priceFromSettings = result.fromSettings;
            if (this.isResin) this.priceEditable = false;
          }
        },
        error: () => {
          this.loadingPrice = false;
        },
      });
  }

  onSubmit(): void {
    const payload: Partial<Supply> = {
      name: this.name.trim(),
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

  private resetForm(): void {
    if (this.supply) {
      this.name = this.supply.name;
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
      this.priceEditable = this.isFilament;
    } else {
      this.name = '';
      this.type = SupplyType.FILAMENTO;
      this.filamentType = FilamentType.PLA;
      this.resinType = ResinType.ESTANDAR;
      this.brand = '';
      this.quantity = 0;
      this.minStock = 0;
      this.unitPrice = 0;
      this.priceFromSettings = false;
      this.supplier = '';
      this.priceEditable = true;
      this.setDefaultUnit();
    }
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
}
