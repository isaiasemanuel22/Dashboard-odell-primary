import { Injectable, inject } from '@angular/core';
import { firstValueFrom, merge, Subject, Subscription, takeUntil } from 'rxjs';
import {
  CreateProductPayload,
  ImpresoWithCost,
  Product,
  ProductType,
  UpdateProductPayload,
  isProductType3D,
} from '../../../core/models';
import { CatalogFacade } from '../../../store/catalog/catalog.facade';
import { SettingsFacade } from '../../../store/settings/settings.facade';
import { ProductFormPricingFacade } from '../../../store/product-form-pricing/product-form-pricing.facade';
import { SuppliesFacade } from '../../../store/supplies/supplies.facade';
import { MediaUploadService } from '../../../core/services/media-upload.service';
import { ImpresosService } from '../../../core/services/impresos.service';
import { ProductPayloadBuilderService } from '../../../core/services/product-payload-builder.service';
import {
  ProductFormGroup,
  ProductFormState,
  ProductFormStateManagerService,
} from '../../../core/services/product-form-state-manager.service';
import { normalizeProductComponents } from '../../../shared/utils/product.helpers';
import {
  createEmptyEstampadoPressCycle,
  createEmptyEstampadoPrint,
} from '../../../shared/utils/estampado.helpers';
import {
  createEmptyFdmFilamentLine,
  storedFdmFilaments,
  totalFdmFilamentGrams,
} from '../../../shared/utils/fdm.helpers';
import {
  productTypeOptions,
  resinTypeOptions,
} from '../../../shared/utils/select-options';
import {
  DbAttachmentUploadFn,
  DbFileUploadFn,
} from '@general-components';
import { ProductFormPricingService } from './product-form-pricing.service';
import { ProductFormBasicFieldsValue } from './sections/product-form-basic-fields.component';
import { ProductFormComponentsValue } from './sections/product-form-components-section.component';
import {
  formCategoryIds,
  formComponents,
  formIncludesPieces,
  formType,
  hasEstampadoPricingInput,
  isForm3D,
  isFormCombo,
  isFormEstampado,
  isFormFdm,
  isFormResina,
  showFormComponentsSection,
  showFormGenericSizeField,
  showFormIncludesPiecesCheckbox,
  showFormProductionFields,
  usesFormPieceAssembly,
} from './product-form.view-model';

@Injectable()
export class ProductFormFacade {
  private readonly stateManager = inject(ProductFormStateManagerService);
  private readonly pricing = inject(ProductFormPricingService);
  private readonly payloadBuilder = inject(ProductPayloadBuilderService);
  private readonly impresosService = inject(ImpresosService);
  private readonly mediaUpload = inject(MediaUploadService);
  private readonly catalogFacade = inject(CatalogFacade);
  private readonly settingsFacade = inject(SettingsFacade);
  private readonly suppliesFacade = inject(SuppliesFacade);
  private readonly pricingStore = inject(ProductFormPricingFacade);
  private readonly destroy$ = new Subject<void>();

  readonly productTypeOptions = productTypeOptions();
  readonly resinTypeOptions = resinTypeOptions();
  readonly form: ProductFormGroup = this.stateManager.buildFormGroup(
    this.stateManager.createInitialState(),
  );

  catalogProducts: Product[] = [];
  impresos: ImpresoWithCost[] = [];
  product: Product | null = null;

  legacyImagesNotice = '';
  savingImages = false;
  imageUploadError = '';
  savingAttachments = false;
  attachmentUploadError = '';

  private catalogSubscription: Subscription | null = null;
  readonly basicFieldsSync$ = new Subject<void>();
  readonly categoryIdsSync$ = new Subject<void>();
  readonly componentsSync$ = new Subject<void>();

  readonly uploadProductImage: DbFileUploadFn = (file) =>
    firstValueFrom(this.mediaUpload.uploadProductImage(file));

  readonly uploadProductAttachment: DbAttachmentUploadFn = (file) =>
    firstValueFrom(this.mediaUpload.uploadProductAttachment(file));

  init(product: Product | null): void {
    this.product = product;
    this.pricingStore.reset();
    this.syncPricingContext();
    this.pricing.init();
    this.setupFormSubscriptions();
    this.loadCatalog();

    if (!this.settingsFacade.peekGeneralSettings()) {
      this.settingsFacade.load();
    }

    this.suppliesFacade.load(false);

    this.loadImpresos();

    if (product) {
      this.resetForm();
    }

    this.pricingStore.setProductType(formType(this.form));
  }

  setProduct(product: Product | null): void {
    this.product = product;
    this.syncPricingContext();
    this.resetForm();
  }

  destroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.catalogSubscription?.unsubscribe();
    this.pricing.destroy();
    this.pricingStore.reset();
  }

  get type(): ProductType {
    return formType(this.form);
  }

  get name(): string {
    return this.form.controls.name.value;
  }

  get basicFieldsValue(): ProductFormBasicFieldsValue {
    const v = this.form.getRawValue();
    return {
      type: v.type,
      name: v.name,
      published: v.published,
      includesPieces: v.includesPieces,
      finishedStock: v.finishedStock,
    };
  }

  patchBasicFields(value: ProductFormBasicFieldsValue): void {
    this.form.patchValue(value);
  }

  get categoryIdsValue(): string[] {
    return this.form.controls.categoryIds.value;
  }

  patchCategoryIds(categoryIds: string[]): void {
    this.form.patchValue({ categoryIds }, { emitEvent: false });
  }

  get componentsValue(): ProductFormComponentsValue {
    const v = this.form.getRawValue();
    return {
      components: v.components,
      assemblyTimeHours: v.assemblyTimeHours,
    };
  }

  patchComponentsValue(value: ProductFormComponentsValue): void {
    this.form.patchValue(value);
  }

  get includesPieces(): boolean {
    return formIncludesPieces(this.form);
  }

  get categoryIds(): string[] {
    return formCategoryIds(this.form);
  }

  get components() {
    return formComponents(this.form);
  }

  get filamentType() {
    return this.form.controls.filamentType.value;
  }

  get suggestedPrice() {
    return this.form.controls.suggestedPrice.value;
  }

  get isCombo() {
    return isFormCombo(this.form);
  }

  get isEstampado() {
    return isFormEstampado(this.form);
  }

  get usesPieceAssembly() {
    return usesFormPieceAssembly(this.form);
  }

  get showIncludesPiecesCheckbox() {
    return showFormIncludesPiecesCheckbox(this.form);
  }

  get showProductionFields() {
    return showFormProductionFields(this.form);
  }

  get showGenericSizeField() {
    return showFormGenericSizeField(this.form);
  }

  get showComponentsSection() {
    return showFormComponentsSection(this.form);
  }

  get is3D() {
    return isForm3D(this.form);
  }

  get isFdm() {
    return isFormFdm(this.form);
  }

  get isResina() {
    return isFormResina(this.form);
  }

  get canAutoCalculateCost() {
    return this.pricing.canAutoCalculate();
  }

  get calculatingCost() {
    return this.pricingStore.peekCalculating();
  }

  get costBreakdown() {
    return this.pricingStore.peekCostBreakdown();
  }

  get profitMargins() {
    return this.pricing.profitMargins;
  }

  get effectiveCost() {
    return this.pricingStore.peekTotalCost();
  }

  get finalPrice() {
    return this.pricingStore.peekPrice();
  }

  get profit() {
    return this.pricingStore.peekProfit();
  }

  get displayedProfitMargin() {
    return this.pricingStore.peekProfitMargin();
  }

  get configuredProfitMarginLabel() {
    return this.pricingStore.peekProfitMarginLabel();
  }

  buildSubmitPayload(): CreateProductPayload | UpdateProductPayload {
    const pricing = this.pricing.prepareForSubmit();
    const v = this.form.getRawValue();
    const usesPieceAssembly =
      v.type === ProductType.COMBO ||
      v.includesPieces ||
      v.components.length > 0;
    return this.payloadBuilder.buildCreatePayload({
      type: v.type,
      name: v.name,
      isCombo: v.type === ProductType.COMBO,
      is3D: isProductType3D(v.type),
      isFdm: v.type === ProductType.FDM,
      isResina: v.type === ProductType.RESINA,
      isEstampado: v.type === ProductType.ESTAMPADO,
      usesPieceAssembly,
      finalPrice: pricing.finalPrice,
      effectiveCost: pricing.effectiveCost,
      suggestedPrice: v.suggestedPrice,
      categoryIds: v.categoryIds,
      images: v.images,
      attachments: v.attachments,
      published: v.published,
      finishedStock: v.finishedStock,
      components: v.components,
      assemblyTimeHours: v.assemblyTimeHours,
      grams: v.grams,
      totalFilamentGrams: totalFdmFilamentGrams(v.filamentLines),
      printTimeHours: v.printTimeHours,
      workTimeHours: v.workTimeHours,
      filaments: storedFdmFilaments(v.filamentLines),
      filamentType: v.filamentType,
      filamentLines: v.filamentLines,
      resinType: v.resinType,
      washMinutes: v.washMinutes,
      cureMinutes: v.cureMinutes,
      prints: v.prints,
      pressCycles: v.pressCycles,
      supplyLines: v.supplyLines,
      sizeWidthCm: v.sizeWidthCm,
      sizeLengthCm: v.sizeLengthCm,
      sizeHeightCm: v.sizeHeightCm,
      impresos: this.impresos,
    });
  }

  private setupFormSubscriptions(): void {
    this.form.controls.type.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.handleTypeChange());

    this.form.controls.includesPieces.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((enabled) => this.pricing.onIncludesPiecesChange(enabled));

    merge(
      this.form.controls.grams.valueChanges,
      this.form.controls.printTimeHours.valueChanges,
      this.form.controls.workTimeHours.valueChanges,
      this.form.controls.washMinutes.valueChanges,
      this.form.controls.cureMinutes.valueChanges,
      this.form.controls.resinType.valueChanges,
      this.form.controls.prints.valueChanges,
      this.form.controls.pressCycles.valueChanges,
      this.form.controls.supplyLines.valueChanges,
      this.form.controls.filamentLines.valueChanges,
    )
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.pricing.onProductionFieldChange());

    this.form.controls.components.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.pricing.onComponentsChange());

    this.form.controls.assemblyTimeHours.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.pricing.onComponentsChange());
  }

  private handleTypeChange(): void {
    const patch: Partial<ProductFormState> = {};

    if (this.isEstampado && !this.form.controls.prints.value.length) {
      patch.prints = [createEmptyEstampadoPrint()];
      patch.pressCycles = [createEmptyEstampadoPressCycle()];
    }
    if (this.isFdm && !this.form.controls.filamentLines.value.length) {
      patch.filamentLines = [createEmptyFdmFilamentLine()];
    }

    this.form.patchValue(patch, { emitEvent: false });
    this.pricingStore.setProductType(formType(this.form));
    this.pricing.onTypeChange();
  }

  private loadImpresos(): void {
    this.impresosService.getImpresos().subscribe((items) => {
      this.impresos = items;
      if (this.isEstampado) {
        this.pricing.scheduleCostCalculation();
      }
    });
  }

  private loadCatalog(): void {
    this.catalogSubscription?.unsubscribe();
    this.catalogFacade.loadAllProducts(true);
    this.catalogSubscription = this.catalogFacade.allProducts$.subscribe(
      (products) => {
        this.catalogProducts = products;
        this.syncPricingContext();

        if (this.product) {
          const normalized = normalizeProductComponents(
            this.product.components ?? [],
            this.catalogProducts,
          );
          this.form.patchValue({ components: normalized }, { emitEvent: false });
          if (normalized.length > 0) {
            this.form.patchValue(
              { includesPieces: true },
              { emitEvent: false },
            );
            this.notifyBasicFieldsSync();
          }
          this.notifyComponentsSync();
        }

        if (this.canAutoCalculateCost || this.usesPieceAssembly) {
          this.pricing.scheduleCostCalculation();
        }
      },
    );
  }

  private resetForm(): void {
    const state = this.product
      ? this.stateManager.loadFromProduct(this.product, this.catalogProducts)
      : this.stateManager.createInitialState();
    this.applyState(state);
    this.pricing.scheduleCostCalculation();
  }

  private applyState(state: ProductFormState): void {
    this.stateManager.patchFormFromState(this.form, state);
    this.legacyImagesNotice = state.legacyImagesNotice;
    this.pricing.resetFromState({
      cost: state.cost,
      costBreakdown: state.costBreakdown,
      computedPrice: state.computedPrice,
      appliedMarginPercent: state.appliedMarginPercent,
    });
    this.notifyBasicFieldsSync();
    this.notifyCategoryIdsSync();
    this.notifyComponentsSync();
  }

  private notifyBasicFieldsSync(): void {
    this.basicFieldsSync$.next();
  }

  private notifyCategoryIdsSync(): void {
    this.categoryIdsSync$.next();
  }

  private notifyComponentsSync(): void {
    this.componentsSync$.next();
  }

  private syncPricingContext(): void {
    this.pricing.bind({
      form: this.form,
      catalogProducts: this.catalogProducts,
      product: this.product,
    });
  }
}
