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
import { DbColorSelectComponent, DbInputComponent } from '@dashboard-form';
import { OrderQuote3dCompositionComponent } from '../../../orders/order-form/linea/order-quote-3d-composition/order-quote-3d-composition.component';
import { OrderQuoteEstampadoCompositionComponent } from '../../../orders/order-form/linea/order-quote-estampado-composition/order-quote-estampado-composition.component';
import { createEmptyFdmFilamentLine } from '../../../../shared/utils/fdm.helpers';
import {
  createEmptyEstampadoPressCycle,
  createEmptyEstampadoPrint,
} from '../../../../shared/utils/estampado.helpers';

@Component({
  selector: 'app-product-form-production-fields',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    DbInputComponent,
    DbColorSelectComponent,
    OrderQuote3dCompositionComponent,
    OrderQuoteEstampadoCompositionComponent,
  ],
  templateUrl: './product-form-production-fields.component.html',
  styleUrl: './product-form-production-fields.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductFormProductionFieldsComponent implements OnInit, OnChanges {
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  @Input({ required: true }) form!: ProductFormGroup;
  @Input({ required: true }) productType!: ProductType;
  @Input() includesPieces = false;

  /** Puente mutable hacia los bloques de quote (mutan el draft in-place). */
  line: OrderLineDraft = this.createDraft(ProductType.FDM);

  private writing = false;

  ngOnInit(): void {
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

  get isResina(): boolean {
    return this.productType === ProductType.RESINA;
  }

  get is3D(): boolean {
    return isProductType3D(this.productType);
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
        pressCycles: structuredClone(line.estampadoPressCycles ?? []),
      },
      { emitEvent: true },
    );
    this.writing = false;
    this.cdr.markForCheck();
  }

  private hydrateLineFromForm(): void {
    const v = this.form.getRawValue();
    const draft = this.createDraft(this.productType);
    const isResina = this.productType === ProductType.RESINA;
    const isFdm = this.productType === ProductType.FDM;

    draft.printTimeHours = Number(v.printTimeHours) || 0;
    draft.workTimeHours = Number(v.workTimeHours) || 0;
    draft.grams = Number(v.grams) || 0;

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
      draft.filaments = structuredClone(
        v.filamentLines?.length
          ? v.filamentLines
          : [createEmptyFdmFilamentLine(v.filamentType)],
      );
    }

    if (this.productType === ProductType.ESTAMPADO) {
      draft.estampadoPrints = structuredClone(
        v.prints?.length ? v.prints : [createEmptyEstampadoPrint()],
      );
      draft.estampadoSupplies = structuredClone(v.supplyLines ?? []);
      draft.estampadoPressCycles = structuredClone(
        v.pressCycles?.length
          ? v.pressCycles
          : [createEmptyEstampadoPressCycle()],
      );
    }

    // Misma referencia si no cambia el servicio → no se colapsan los <details>.
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
        this.line.printProcess = 'resina';
      }
    } else {
      this.line = draft;
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
