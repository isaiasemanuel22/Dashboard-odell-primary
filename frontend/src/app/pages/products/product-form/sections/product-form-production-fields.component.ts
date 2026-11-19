import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  Input,
  OnChanges,
  OnInit,
  SimpleChanges,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import {
  FilamentType,
  OrderLineDraft,
  ProductType,
  ResinType,
  ServiceType,
  isProductType3D,
} from '../../../../core/models';
import { ProductFormGroup } from '../services/product-form-state-manager.service';
import {
  DbCheckboxComponent,
  DbColorSelectComponent,
  DbInputComponent,
} from '@dashboard-form';
import { OrderQuote3dCompositionComponent } from '../../../orders/order-form/linea/order-quote-3d-composition/order-quote-3d-composition.component';
import { OrderQuoteEstampadoSuppliesComponent } from '../../../../components/order-quote-estampado-supplies/order-quote-estampado-supplies.component';
import { supplyLinesValue } from '../../../../shared/utils/supply-line-value.util';
import { SuppliesService } from '../../../../core/services/settings.service';
import { Supply } from '../../../../core/models';
import { OrderQuoteEstampadoCompositionComponent } from '../../../orders/order-form/linea/order-quote-estampado-composition/order-quote-estampado-composition.component';
import {
  createEmptyFdmFilamentLine,
  normalizePurgeGrams,
} from '../../../../shared/utils/fdm.helpers';
import {
  createEmptyEstampadoPressCycle,
  createEmptyEstampadoPrint,
} from '../../../../shared/utils/estampado.helpers';
import { ProductFormAmsPurgeRowComponent } from './product-form-ams-purge-row/product-form-ams-purge-row.component';

@Component({
  selector: 'app-product-form-production-fields',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    DbInputComponent,
    DbColorSelectComponent,
    DbCheckboxComponent,
    OrderQuote3dCompositionComponent,
    OrderQuoteEstampadoCompositionComponent,
    OrderQuoteEstampadoSuppliesComponent,
    ProductFormAmsPurgeRowComponent,
  ],
  templateUrl: './product-form-production-fields.component.html',
  styleUrl: './product-form-production-fields.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductFormProductionFieldsComponent implements OnInit, OnChanges {
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly suppliesService = inject(SuppliesService);
  private supplies: Supply[] = [];

  @Input({ required: true }) form!: ProductFormGroup;
  @Input({ required: true }) productType!: ProductType;
  @Input() includesPieces = false;
  @Input() printHoursFrom3mf = false;
  @Input() purgeFrom3mf = false;

  /** Puente mutable hacia los bloques de quote (mutan el draft in-place). */
  line: OrderLineDraft = this.createDraft(ProductType.FDM);

  private writing = false;
  /** Listas de Estampado como las vio el form la última vez (E132). */
  private syncedPrints: unknown = null;
  private syncedSupplies: unknown = null;
  private syncedCycles: unknown = null;

  ngOnInit(): void {
    this.suppliesService
      .watchSupplies()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((items) => {
        this.supplies = items;
        this.cdr.markForCheck();
      });
    this.hydrateLineFromForm();

    this.form.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.writing) return;
        this.hydrateLineFromForm();
        this.cdr.markForCheck();
      });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['productType'] && !changes['productType'].firstChange) {
      this.hydrateLineFromForm();
      this.cdr.markForCheck();
    }
  }

  get showProductionFields(): boolean {
    return this.productType !== ProductType.COMBO && !this.includesPieces;
  }

  get showGenericSizeField(): boolean {
    return (
      this.productType !== ProductType.COMBO &&
      (this.productType !== ProductType.ESTAMPADO || this.includesPieces)
    );
  }

  get isEstampado(): boolean {
    return this.productType === ProductType.ESTAMPADO;
  }

  get isCombo(): boolean {
    return this.productType === ProductType.COMBO;
  }

  get isResina(): boolean {
    return this.productType === ProductType.RESINA;
  }

  get is3D(): boolean {
    return isProductType3D(this.productType);
  }

  get isFdm(): boolean {
    return this.productType === ProductType.FDM;
  }

  get suppliesCost(): number {
    return supplyLinesValue(this.line.estampadoSupplies, (supplyId) => {
      const supply = this.supplies.find((item) => item.id === supplyId);
      return supply ? Number(supply.unitPrice) || 0 : 0;
    });
  }

  get packagingCost(): number {
    return supplyLinesValue(this.line.packagingSupplies, (supplyId) => {
      const supply = this.supplies.find((item) => item.id === supplyId);
      return supply ? Number(supply.unitPrice) || 0 : 0;
    });
  }

  get printProcess(): 'fdm' | 'resina' | undefined {
    if (this.productType === ProductType.RESINA) return 'resina';
    if (this.productType === ProductType.FDM) return 'fdm';
    return undefined;
  }

  onQuoteChanged(): void {
    this.writing = true;
    const line = this.line;
    const filaments = line.filaments?.length
      ? structuredClone(line.filaments)
      : [createEmptyFdmFilamentLine(this.form.controls.filamentType.value)];

    this.form.patchValue(
      {
        filamentLines: filaments,
        filamentType:
          (filaments.find((row) => row.filamentType)?.filamentType as FilamentType) ??
          this.form.controls.filamentType.value,
        grams: Number(line.grams) || 0,
        resinType:
          (line.resinType as ResinType | string) ??
          this.form.controls.resinType.value,
        printTimeHours: Number(line.printTimeHours) || 0,
        workTimeHours: Number(line.workTimeHours) || 0,
        washMinutes: Number(line.washMinutes) || 0,
        cureMinutes: Number(line.cureMinutes) || 0,
        prints: structuredClone(line.estampadoPrints ?? []),
        supplyLines: structuredClone(line.estampadoSupplies ?? []),
        packagingLines: structuredClone(line.packagingSupplies ?? []),
        pressCycles: structuredClone(line.estampadoPressCycles ?? []),
      },
      { emitEvent: true },
    );
    const synced = this.form.getRawValue();
    this.syncedPrints = structuredClone(synced.prints ?? []);
    this.syncedSupplies = structuredClone(synced.supplyLines ?? []);
    this.syncedCycles = structuredClone(synced.pressCycles ?? []);
    this.writing = false;
    this.cdr.markForCheck();
  }

  onPurgeGramsChange(value: number | null): void {
    this.form.controls.purgeGrams.setValue(normalizePurgeGrams(value), {
      emitEvent: true,
    });
    this.cdr.markForCheck();
  }

  private hydrateLineFromForm(): void {
    const v = this.form.getRawValue();
    const draft = this.createDraft(this.productType);
    const isResina = this.productType === ProductType.RESINA;
    const isFdm = this.productType === ProductType.FDM;

    draft.printTimeHours = Number(v.printTimeHours) || 0;
    draft.packagingSupplies = structuredClone(v.packagingLines ?? []);
    draft.workTimeHours = Number(v.workTimeHours) || 0;
    draft.grams = Number(v.grams) || 0;

    if (isResina || isFdm || this.productType === ProductType.COMBO) {
      draft.estampadoSupplies = structuredClone(v.supplyLines ?? []);
    }

    if (isResina) {
      // isResinQuoteLine() trata cualquier resinType como resina: solo setearlo en RESINA.
      draft.printProcess = 'resina';
      draft.resinType = v.resinType;
      draft.washMinutes = Number(v.washMinutes) || 0;
      draft.cureMinutes = Number(v.cureMinutes) || 0;
      draft.filaments = undefined;
      draft.filamentType = undefined;
    } else if (isFdm) {
      draft.printProcess = 'fdm';
      draft.resinType = undefined;
      draft.washMinutes = undefined;
      draft.cureMinutes = undefined;
      draft.filamentType = v.filamentType;
      draft.purgeGrams = normalizePurgeGrams(v.purgeGrams);
      const nextFilaments = structuredClone(
        v.filamentLines?.length
          ? v.filamentLines
          : [createEmptyFdmFilamentLine(v.filamentType)],
      );
      draft.filaments = this.sameJson(this.line.filaments, nextFilaments)
        ? this.line.filaments
        : nextFilaments;
    }

    if (this.productType === ProductType.ESTAMPADO) {
      // E132: si el form no cambió estas listas desde la última sincronización,
      // lo escrito en `line` (todavía sin pasar al form) no se pisa.
      const formPrints = v.prints ?? [];
      const formSupplies = v.supplyLines ?? [];
      const formCycles = v.pressCycles ?? [];
      const keepLine = this.line.serviceType === draft.serviceType;
      const prints = this.sameJson(formPrints, this.syncedPrints) && keepLine
        ? this.line.estampadoPrints
        : undefined;
      const supplies = this.sameJson(formSupplies, this.syncedSupplies) && keepLine
        ? this.line.estampadoSupplies
        : undefined;
      const cycles = this.sameJson(formCycles, this.syncedCycles) && keepLine
        ? this.line.estampadoPressCycles
        : undefined;
      draft.estampadoPrints = structuredClone(
        prints ?? (formPrints.length ? formPrints : [createEmptyEstampadoPrint()]),
      );
      draft.estampadoSupplies = structuredClone(supplies ?? formSupplies);
      draft.estampadoPressCycles = structuredClone(
        cycles ??
          (formCycles.length ? formCycles : [createEmptyEstampadoPressCycle()]),
      );
      this.syncedPrints = structuredClone(formPrints);
      this.syncedSupplies = structuredClone(formSupplies);
      this.syncedCycles = structuredClone(formCycles);
    }

    // Misma identidad de servicio; nueva referencia de objeto para que los
    // hijos OnPush (filamentos / impresión / DynamicList) rebinden ngModel.
    // Mutar `line` in-place dejaba el form (y el pricing) al día pero los
    // controles seguían mostrando el draft viejo tras un import .3mf.
    if (this.line.serviceType === draft.serviceType) {
      Object.assign(this.line, draft);
      // Object.assign no borra claves ausentes: forzar limpieza FDM↔resina.
      if (isFdm) {
        this.line.resinType = undefined;
        this.line.washMinutes = undefined;
        this.line.cureMinutes = undefined;
        this.line.printProcess = 'fdm';
      } else if (isResina) {
        this.line.filaments = undefined;
        this.line.filamentType = undefined;
        this.line.purgeGrams = undefined;
        this.line.printProcess = 'resina';
      }
      this.line = { ...this.line };
    } else {
      this.line = draft;
    }
  }

  private sameJson(a: unknown, b: unknown): boolean {
    try {
      return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
    } catch {
      return false;
    }
  }

  private createDraft(type: ProductType): OrderLineDraft {
    if (type === ProductType.ESTAMPADO) {
      return {
        serviceType: ServiceType.ESTAMPADO,
        productId: '',
        quantity: 1,
        unitPrice: 0,
      };
    }
    return {
      serviceType: ServiceType.IMPRESION_3D,
      productId: '',
      quantity: 1,
      unitPrice: 0,
      printProcess: type === ProductType.RESINA ? 'resina' : 'fdm',
    };
  }
}
