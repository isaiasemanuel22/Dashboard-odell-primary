import { Injectable } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import {
  Product,
  ProductType,
  FilamentType,
  ResinType,
  ProductEstampado,
  INDISTINTO_COLOR_ID,
} from '../../../../core/models';
import {
  createEmptyFdmFilamentLine,
  normalizeFdmFilaments,
} from '../../../../shared/utils/fdm.helpers';
import {
  createEmptyEstampadoPrint,
  createEmptyEstampadoPressCycle,
  parseSizeFieldsFromString,
} from '../../../../shared/utils/estampado.helpers';
import { normalizeProductComponents } from '../../../../shared/utils/product.helpers';
import {
  normalizeProductAttachments,
} from '../../../../shared/utils/product-attachment.helpers';
import {
  sanitizePersistableProductImages,
} from '../../../../shared/utils/media-url.util';

/**
 * Estado inicial del formulario de producto
 */
export interface ProductFormState {
  type: ProductType;
  name: string;
  sizeWidthCm: number;
  sizeLengthCm: number;
  sizeHeightCm: number;
  cost: number;
  suggestedPrice: number | null;
  categoryIds: string[];
  images: string[];
  attachments: any[];
  grams: number;
  printTimeHours: number;
  workTimeHours: number;
  washMinutes: number;
  cureMinutes: number;
  prints: any[];
  pressCycles: any[];
  supplyLines: any[];
  filamentLines: any[];
  filamentType: FilamentType;
  resinType: ResinType;
  colorId: string;
  components: any[];
  assemblyTimeHours: number;
  published: boolean;
  includesPieces: boolean;
  finishedStock: number;
  costBreakdown: any;
  computedPrice: number | null;
  appliedMarginPercent: number | null;
  legacyImagesNotice: string;
  categoryPicker: string;
  componentPicker: string;
  componentQty: number;
}

export type ProductFormGroup = FormGroup<{
  type: FormControl<ProductType>;
  name: FormControl<string>;
  published: FormControl<boolean>;
  includesPieces: FormControl<boolean>;
  finishedStock: FormControl<number>;
  sizeWidthCm: FormControl<number>;
  sizeLengthCm: FormControl<number>;
  sizeHeightCm: FormControl<number>;
  grams: FormControl<number>;
  printTimeHours: FormControl<number>;
  workTimeHours: FormControl<number>;
  washMinutes: FormControl<number>;
  cureMinutes: FormControl<number>;
  resinType: FormControl<ResinType>;
  colorId: FormControl<string>;
  filamentType: FormControl<FilamentType>;
  assemblyTimeHours: FormControl<number>;
  suggestedPrice: FormControl<number | null>;
  categoryIds: FormControl<string[]>;
  categoryPicker: FormControl<string>;
  components: FormControl<ProductFormState['components']>;
  componentPicker: FormControl<string>;
  componentQty: FormControl<number>;
  images: FormControl<string[]>;
  attachments: FormControl<ProductFormState['attachments']>;
  prints: FormControl<ProductFormState['prints']>;
  pressCycles: FormControl<ProductFormState['pressCycles']>;
  supplyLines: FormControl<ProductFormState['supplyLines']>;
  filamentLines: FormControl<ProductFormState['filamentLines']>;
}>;

/**
 * Maneja la inicialización y reset del estado del formulario
 * Centraliza la lógica que estaba dispersa en `ngOnInit`, `ngOnChanges` y `resetForm`
 */
@Injectable({
  providedIn: 'root',
})
export class ProductFormStateManagerService {
  /**
   * Crea el estado inicial del formulario para un nuevo producto
   */
  createInitialState(): ProductFormState {
    return {
      type: ProductType.FDM,
      name: '',
      sizeWidthCm: 0,
      sizeLengthCm: 0,
      sizeHeightCm: 0,
      cost: 0,
      suggestedPrice: null,
      categoryIds: [],
      images: [],
      attachments: [],
      grams: 0,
      printTimeHours: 0,
      workTimeHours: 0,
      washMinutes: 0,
      cureMinutes: 0,
      prints: [],
      pressCycles: [],
      supplyLines: [],
      filamentLines: [createEmptyFdmFilamentLine()],
      filamentType: FilamentType.PLA,
      resinType: ResinType.ESTANDAR,
      colorId: INDISTINTO_COLOR_ID,
      components: [],
      assemblyTimeHours: 0,
      published: true,
      includesPieces: false,
      finishedStock: 0,
      costBreakdown: null,
      computedPrice: null,
      appliedMarginPercent: null,
      legacyImagesNotice: '',
      categoryPicker: '',
      componentPicker: '',
      componentQty: 1,
    };
  }

  buildFormGroup(state: ProductFormState): ProductFormGroup {
    return new FormGroup({
      type: new FormControl(state.type, { nonNullable: true }),
      name: new FormControl(state.name, {
        nonNullable: true,
        validators: [Validators.required],
      }),
      published: new FormControl(state.published, { nonNullable: true }),
      includesPieces: new FormControl(state.includesPieces, {
        nonNullable: true,
      }),
      finishedStock: new FormControl(state.finishedStock, {
        nonNullable: true,
        validators: [Validators.min(0)],
      }),
      sizeWidthCm: new FormControl(state.sizeWidthCm, { nonNullable: true }),
      sizeLengthCm: new FormControl(state.sizeLengthCm, { nonNullable: true }),
      sizeHeightCm: new FormControl(state.sizeHeightCm, { nonNullable: true }),
      grams: new FormControl(state.grams, { nonNullable: true }),
      printTimeHours: new FormControl(state.printTimeHours, {
        nonNullable: true,
      }),
      workTimeHours: new FormControl(state.workTimeHours, {
        nonNullable: true,
      }),
      washMinutes: new FormControl(state.washMinutes, { nonNullable: true }),
      cureMinutes: new FormControl(state.cureMinutes, { nonNullable: true }),
      resinType: new FormControl(state.resinType, { nonNullable: true }),
      colorId: new FormControl(state.colorId, { nonNullable: true }),
      filamentType: new FormControl(state.filamentType, { nonNullable: true }),
      assemblyTimeHours: new FormControl(state.assemblyTimeHours, {
        nonNullable: true,
      }),
      suggestedPrice: new FormControl(state.suggestedPrice),
      categoryIds: new FormControl(state.categoryIds, { nonNullable: true }),
      categoryPicker: new FormControl(state.categoryPicker, {
        nonNullable: true,
      }),
      components: new FormControl(state.components, { nonNullable: true }),
      componentPicker: new FormControl(state.componentPicker, {
        nonNullable: true,
      }),
      componentQty: new FormControl(state.componentQty, { nonNullable: true }),
      images: new FormControl(state.images, { nonNullable: true }),
      attachments: new FormControl(state.attachments, { nonNullable: true }),
      prints: new FormControl(state.prints, { nonNullable: true }),
      pressCycles: new FormControl(state.pressCycles, { nonNullable: true }),
      supplyLines: new FormControl(state.supplyLines, { nonNullable: true }),
      filamentLines: new FormControl(state.filamentLines, {
        nonNullable: true,
      }),
    });
  }

  patchFormFromState(form: ProductFormGroup, state: ProductFormState): void {
    form.patchValue(
      {
        type: state.type,
        name: state.name,
        published: state.published,
        includesPieces: state.includesPieces,
        finishedStock: state.finishedStock,
        sizeWidthCm: state.sizeWidthCm,
        sizeLengthCm: state.sizeLengthCm,
        sizeHeightCm: state.sizeHeightCm,
        grams: state.grams,
        printTimeHours: state.printTimeHours,
        workTimeHours: state.workTimeHours,
        washMinutes: state.washMinutes,
        cureMinutes: state.cureMinutes,
        resinType: state.resinType,
        colorId: state.colorId,
        filamentType: state.filamentType,
        assemblyTimeHours: state.assemblyTimeHours,
        suggestedPrice: state.suggestedPrice,
        categoryIds: state.categoryIds,
        categoryPicker: state.categoryPicker,
        components: state.components,
        componentPicker: state.componentPicker,
        componentQty: state.componentQty,
        images: state.images,
        attachments: state.attachments,
        prints: state.prints,
        pressCycles: state.pressCycles,
        supplyLines: state.supplyLines,
        filamentLines: state.filamentLines,
      },
      { emitEvent: false },
    );
  }

  /**
   * Carga el estado desde un producto existente
   */
  loadFromProduct(
    product: Product,
    catalogProducts: Product[],
  ): ProductFormState {
    const state = this.createInitialState();

    state.type = product.type;
    state.name = product.name;
    this.applySizeFieldsFromString(state, product.size);
    state.cost = product.cost;
    state.suggestedPrice = null;
    state.categoryIds = [...product.categoryIds];

    const sanitizedImages = sanitizePersistableProductImages(product.images);
    state.images = sanitizedImages.images;
    state.attachments = normalizeProductAttachments(product.attachments);
    state.legacyImagesNotice =
      sanitizedImages.removedCount > 0
        ? 'Hay fotos con URLs antiguas que ya no funcionan. Volvé a subirlas; se guardarán en Firebase Storage.'
        : '';

    state.components = normalizeProductComponents(
      product.components ?? [],
      catalogProducts,
    );
    state.assemblyTimeHours = product.assemblyTimeHours ?? 0;
    state.published = product.published !== false;
    state.includesPieces =
      product.type === ProductType.COMBO ||
      product.includesPieces === true ||
      state.components.length > 0;
    state.finishedStock = Math.max(
      0,
      Math.trunc(Number(product.stock ?? product.finishedStock) || 0),
    );

    if (product.type === ProductType.COMBO) {
      state.includesPieces = true;
    } else if (
      product.type === ProductType.FDM ||
      product.type === ProductType.RESINA
    ) {
      state.grams = product.grams;
      state.printTimeHours = product.printTimeHours;
      state.workTimeHours = product.workTimeHours;
      state.filamentType = product.filamentType ?? ('' as FilamentType);
      state.filamentLines = structuredClone(
        normalizeFdmFilaments(product.filaments, {
          grams: product.grams,
          filamentType: product.filamentType,
          brand: product.brand,
        }),
      );
      if (!state.filamentLines.length && product.type === ProductType.FDM) {
        const line = createEmptyFdmFilamentLine(
          state.filamentType || FilamentType.PLA,
        );
        if (!product.filamentType) {
          line.filamentType = '' as FilamentType;
        }
        line.grams = Math.max(0, Number(product.grams) || 0);
        state.filamentLines = [line];
      }
      state.resinType = product.resinType ?? ('' as ResinType);
      state.colorId = product.colorId ?? INDISTINTO_COLOR_ID;
      state.washMinutes = product.washMinutes ?? 0;
      state.cureMinutes = product.cureMinutes ?? 0;
    } else {
      const estampado = product as ProductEstampado;
      state.workTimeHours = estampado.workTimeHours ?? 0;
      state.prints = structuredClone(
        estampado.prints?.length
          ? estampado.prints
          : [createEmptyEstampadoPrint()],
      );
      state.pressCycles = structuredClone(
        estampado.pressCycles?.length
          ? estampado.pressCycles
          : [createEmptyEstampadoPressCycle()],
      );
      state.supplyLines = structuredClone(
        estampado.supplies?.length ? estampado.supplies : [],
      );
    }

    state.costBreakdown = null;
    state.computedPrice =
      Number(product.price) > 0 ? Number(product.price) : null;
    state.appliedMarginPercent = null;
    state.categoryPicker = '';
    state.componentPicker = '';
    state.componentQty = 1;

    return state;
  }

  /**
   * Aplica los campos de tamaño desde un string
   */
  private applySizeFieldsFromString(
    state: ProductFormState,
    size: string,
  ): void {
    const parsed = parseSizeFieldsFromString(size);
    state.sizeWidthCm = parsed.widthCm ?? 0;
    state.sizeLengthCm = parsed.lengthCm ?? 0;
    state.sizeHeightCm = parsed.heightCm ?? 0;
  }

  /**
   * Reinicia los estados de cálculo y precios
   */
  resetPricingState(state: Partial<ProductFormState>): void {
    if (!state) return;
    state.costBreakdown = null;
    state.computedPrice = null;
    state.appliedMarginPercent = null;
  }

  /**
   * Reinicia los componentes y campos relacionados
   */
  resetComponents(state: Partial<ProductFormState>): void {
    if (!state) return;
    state.components = [];
    state.assemblyTimeHours = 0;
    state.componentPicker = '';
    state.componentQty = 1;
  }
}
