import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  ViewChild,
  ChangeDetectorRef,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom, Subscription } from 'rxjs';
import {
  Category,
  CostBreakdown,
  CreateProductPayload,
  EstampadoPressCycle,
  EstampadoPrintSpec,
  EstampadoSupplyLine,
  FilamentType,
  GeneralSettings,
  ImpresoWithCost,
  PaperType,
  Product,
  ProductComponent,
  ProductEstampado,
  ProductType,
  ResinType,
  Supply,
  SupplyCategory,
  UpdateProductPayload,
  isProductType3D,
} from '../../../core/models';
import { ProductCatalogService } from '../../../core/services/product-catalog.service';
import { MediaUploadService } from '../../../core/services/media-upload.service';
import { ProductsService } from '../../../core/services/products.service';
import { ProductPricingService } from '../../../core/services/product-pricing.service';
import { ImpresosService } from '../../../core/services/impresos.service';
import { SuppliesService } from '../../../core/services/settings.service';
import { SettingsFacade } from '../../../store/settings/settings.facade';
import { extractApiErrorMessage } from '../../../shared/utils/api-error';
import {
  productComponentSelectLabel,
  normalizeProductComponents,
  sumComponentsCost,
  sumComponentsPrice,
} from '../../../shared/utils/product.helpers';
import {
  createEmptyEstampadoPressCycle,
  createEmptyEstampadoPrint,
  createEmptyEstampadoSupplyLine,
  formatEstampadoSizeFromPrints,
  formatPrintDimensionsCm,
  hasValidPrintSize,
  isEstampadoPrintValid,
  parseSizeFieldsFromString,
  syncEstampadoPrintFromImpreso,
} from '../../../shared/utils/estampado.helpers';
import {
  getMarginForProductType,
  marginLabelForProductType,
  normalizeProfitMargins,
  priceFromCostAndMargin,
  totalCostFromBreakdown,
} from '../../../shared/utils/pricing.util';
import {
  filamentTypeOptions,
  paperTypeOptions,
  productTypeOptions,
  resinTypeOptions,
} from '../../../shared/utils/select-options';
import { CurrencyArsPipe } from '../../../shared/pipes/labels.pipe';
import {
  DbCheckboxComponent,
  DbFieldsetComponent,
  DbFileUploadComponent,
  DbFileUploadFn,
  DbFormComponent,
  DbFormErrorComponent,
  DbFormFooterComponent,
  DbFormGridComponent,
  DbFormGridFullComponent,
  DbInputComponent,
  DbSelectComponent,
  DbSelectOption,
  DbButtonComponent,
  ProductComponentsTableComponent,
} from '@general-components';
import { FormDialogService } from '../../../shared/form-dialogs/public-api';

@Component({
  selector: 'app-product-form',
  standalone: true,
  imports: [
    FormsModule,
    DbFormComponent,
    DbFormGridComponent,
    DbFormGridFullComponent,
    DbSelectComponent,
    DbInputComponent,
    DbCheckboxComponent,
    DbFieldsetComponent,
    DbFileUploadComponent,
    DbFormErrorComponent,
    DbFormFooterComponent,
    DbButtonComponent,
    CurrencyArsPipe,
    ProductComponentsTableComponent,
  ],
  templateUrl: './product-form.component.html',
  styleUrl: './product-form.component.scss',
})
export class ProductFormComponent implements OnInit, OnChanges, OnDestroy {
  private readonly productsService = inject(ProductsService);
  private readonly productPricing = inject(ProductPricingService);
  private readonly impresosService = inject(ImpresosService);
  private readonly suppliesService = inject(SuppliesService);
  private readonly settingsFacade = inject(SettingsFacade);
  private readonly mediaUpload = inject(MediaUploadService);
  private readonly catalogService = inject(ProductCatalogService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly formDialogs = inject(FormDialogService);

  @Input() product: Product | null = null;
  @Input() categories: Category[] = [];
  @Input() loading = false;
  @Input() error = '';
  @Output() save = new EventEmitter<CreateProductPayload | UpdateProductPayload>();
  @Output() cancel = new EventEmitter<void>();
  @Output() categoriesChange = new EventEmitter<Category[]>();

  @ViewChild('imageUpload') imageUpload?: DbFileUploadComponent;

  readonly productTypeOptions = productTypeOptions();
  readonly filamentTypeOptions = filamentTypeOptions();
  readonly resinTypeOptions = resinTypeOptions();
  readonly paperTypeOptions = paperTypeOptions();

  categoriesList: Category[] = [];
  catalogProducts: Product[] = [];
  impresos: ImpresoWithCost[] = [];
  estampadoSuppliesCatalog: Supply[] = [];
  categoryPicker = '';

  type = ProductType.FDM;
  name = '';
  sizeWidthCm = 0;
  sizeLengthCm = 0;
  sizeHeightCm = 0;
  cost = 0;
  suggestedPrice: number | null = null;
  categoryIds: string[] = [];
  images: string[] = [];
  grams = 0;
  printTimeHours = 0;
  workTimeHours = 0;
  washMinutes = 0;
  cureMinutes = 0;
  prints: EstampadoPrintSpec[] = [];
  pressCycles: EstampadoPressCycle[] = [];
  supplyLines: EstampadoSupplyLine[] = [];
  filamentType = FilamentType.PLA;
  resinType = ResinType.ESTANDAR;
  components: ProductComponent[] = [];
  assemblyTimeHours = 0;
  published = true;
  includesPieces = false;
  componentPicker = '';
  componentQty = 1;
  costBreakdown: CostBreakdown | null = null;
  calculatingCost = false;
  computedPrice: number | null = null;
  appliedMarginPercent: number | null = null;
  profitMargins: GeneralSettings['profitMargins'] | null = null;
  private settingsSubscription = this.settingsFacade
    .watchGeneralSettings()
    .subscribe((settings) => {
      if (!settings) return;
      this.profitMargins = normalizeProfitMargins(settings.profitMargins);
      this.recalculatePriceFromCost();
      this.cdr.markForCheck();
    });
  savingImages = false;
  imageUploadError = '';

  private costCalcTimer: ReturnType<typeof setTimeout> | null = null;
  private pricingPreviewSub: Subscription | null = null;

  readonly uploadProductImage: DbFileUploadFn = (file) =>
    firstValueFrom(this.mediaUpload.uploadProductImage(file));

  ngOnInit(): void {
    this.categoriesList = [...this.categories];
    this.loadCatalog();
    const cached = this.settingsFacade.peekGeneralSettings();
    if (cached) {
      this.profitMargins = normalizeProfitMargins(cached.profitMargins);
    } else {
      this.settingsFacade.load();
    }
    this.impresosService.getImpresos().subscribe((items) => {
      this.impresos = items;
      if (this.isEstampado) {
        this.scheduleCostCalculation();
      }
      this.cdr.markForCheck();
    });
    this.suppliesService
      .getSupplies(undefined, SupplyCategory.ESTAMPADO)
      .subscribe((items) => {
        this.estampadoSuppliesCatalog = items;
        this.cdr.markForCheck();
      });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['categories']) {
      this.categoriesList = [...this.categories];
    }
    if (changes['product']) {
      this.resetForm();
    }
  }

  ngOnDestroy(): void {
    this.settingsSubscription.unsubscribe();
    this.pricingPreviewSub?.unsubscribe();
    this.clearCostCalcTimer();
  }

  get isCombo(): boolean {
    return this.type === ProductType.COMBO;
  }

  get isEstampado(): boolean {
    return this.type === ProductType.ESTAMPADO;
  }

  get usesPieceAssembly(): boolean {
    return this.isCombo || this.includesPieces;
  }

  get showIncludesPiecesCheckbox(): boolean {
    return !this.isCombo;
  }

  get showProductionFields(): boolean {
    return !this.isCombo && !this.includesPieces;
  }

  get showGenericSizeField(): boolean {
    return !this.isCombo && (!this.isEstampado || this.usesPieceAssembly);
  }

  get showComponentsSection(): boolean {
    return this.isCombo || this.includesPieces;
  }

  get is3D(): boolean {
    return isProductType3D(this.type);
  }

  get isFdm(): boolean {
    return this.type === ProductType.FDM;
  }

  get isResina(): boolean {
    return this.type === ProductType.RESINA;
  }

  get hasComponents(): boolean {
    return this.components.length > 0;
  }

  get componentsCostTotal(): number {
    return sumComponentsCost(this.catalogProducts, this.components);
  }

  get componentsPriceTotal(): number {
    return sumComponentsPrice(this.catalogProducts, this.components);
  }

  get configuredProfitMargin(): number {
    if (!this.profitMargins) return 0;
    return getMarginForProductType(this.type, this.profitMargins);
  }

  get displayedProfitMargin(): number {
    return (
      this.appliedMarginPercent ??
      this.configuredProfitMargin
    );
  }

  get configuredProfitMarginLabel(): string {
    return marginLabelForProductType(this.type);
  }

  get effectiveCost(): number {
    const direct = Number(this.cost) || Number(this.product?.cost) || 0;
    if (direct > 0) {
      return direct;
    }
    if (this.costBreakdown) {
      return totalCostFromBreakdown(this.costBreakdown);
    }
    return 0;
  }

  get finalPrice(): number {
    if (this.suggestedPrice != null && Number(this.suggestedPrice) > 0) {
      return Number(this.suggestedPrice);
    }
    if (this.usesPieceAssembly) {
      return this.componentsPriceTotal;
    }
    if (this.computedPrice != null) {
      return this.computedPrice;
    }
    const costValue = this.effectiveCost;
    if (costValue > 0 && this.profitMargins) {
      return priceFromCostAndMargin(costValue, this.configuredProfitMargin);
    }
    return costValue;
  }

  get profit(): number {
    return this.finalPrice - this.effectiveCost;
  }

  get filteredCategories(): Category[] {
    return this.categoriesList.filter((c) => c.productTypes.includes(this.type));
  }

  get unselectedCategoryOptions(): DbSelectOption[] {
    return this.filteredCategories
      .filter((c) => !this.categoryIds.includes(c.id))
      .map((c) => ({ value: c.id, label: c.name }));
  }

  get selectedCategories(): Category[] {
    return this.categoryIds
      .map((id) => this.categoriesList.find((c) => c.id === id))
      .filter((c): c is Category => Boolean(c));
  }

  get canAddCategory(): boolean {
    return this.categoryIds.length < 5 && this.unselectedCategoryOptions.length > 0;
  }

  get availableComponentOptions(): DbSelectOption[] {
    const selfId = this.product?.id;
    const used = new Set(this.components.map((c) => c.productId));
    return this.catalogProducts
      .filter((p) => p.id !== selfId && !used.has(p.id))
      .map((p) => ({
        value: p.id,
        label: productComponentSelectLabel(p),
      }));
  }

  get canAddComponent(): boolean {
    return this.availableComponentOptions.length > 0 && this.componentQty >= 1;
  }

  get formattedSize(): string {
    return formatPrintDimensionsCm(
      this.sizeWidthCm,
      this.sizeLengthCm || undefined,
      this.sizeHeightCm,
    );
  }

  filteredImpresoOptionsFor(paperType: PaperType): DbSelectOption[] {
    return this.impresos
      .filter((item) => item.paperType === paperType)
      .map((item) => ({
        value: item.id,
        label: `${item.name} (${formatPrintDimensionsCm(item.widthCm, item.lengthCm, item.heightCm)})`,
      }));
  }

  filteredSupplyOptionsFor(line: EstampadoSupplyLine): DbSelectOption[] {
    const used = new Set(
      this.supplyLines
        .filter((item) => item.id !== line.id && item.supplyId)
        .map((item) => item.supplyId),
    );
    return this.estampadoSuppliesCatalog
      .filter((supply) => !used.has(supply.id))
      .map((supply) => ({
        value: supply.id,
        label: `${supply.name} (${supply.unit})`,
      }));
  }

  hasValidEstampadoPrints(): boolean {
    return this.prints.some((print) => isEstampadoPrintValid(print));
  }

  hasValidPressCycles(): boolean {
    return this.pressCycles.some(
      (cycle) => Number(cycle.pressMinutes) > 0 && Number(cycle.bajadas) >= 1,
    );
  }

  private hasEstampadoPricingInput(): boolean {
    if (!this.isEstampado || this.usesPieceAssembly) {
      return false;
    }
    const hasPrints = this.prints.some((print) => isEstampadoPrintValid(print));
    const hasSupplies = this.supplyLines.some(
      (line) => line.supplyId && Number(line.quantity) > 0,
    );
    return (
      hasPrints ||
      hasSupplies ||
      this.hasValidPressCycles() ||
      Number(this.workTimeHours) > 0
    );
  }

  get canAutoCalculateCost(): boolean {
    if (this.isCombo) return this.components.length > 0;
    if (this.usesPieceAssembly) return this.components.length > 0;
    if (this.isEstampado) return this.hasEstampadoPricingInput();
    if (!this.is3D) return false;
    return Number(this.grams) > 0;
  }

  onIncludesPiecesChange(enabled: boolean): void {
    this.includesPieces = enabled;
    if (!enabled) {
      this.components = [];
      this.assemblyTimeHours = 0;
      this.componentPicker = '';
      this.componentQty = 1;
    }
    this.onComponentsChange();
  }

  addSupplyLine(): void {
    this.supplyLines = [...this.supplyLines, createEmptyEstampadoSupplyLine()];
    this.onEstampadoConfigChange();
  }

  removeSupplyLine(lineId: string): void {
    this.supplyLines = this.supplyLines.filter((line) => line.id !== lineId);
    this.onEstampadoConfigChange();
  }

  onTypeChange(): void {
    if (this.isCombo) {
      this.includesPieces = true;
      this.published = true;
    }
    this.categoryIds = this.categoryIds.filter((id) =>
      this.filteredCategories.some((c) => c.id === id),
    );
    this.categoryPicker = '';
    if (this.isEstampado && !this.prints.length) {
      this.initEstampadoDefaults();
    }
    this.costBreakdown = null;
    this.computedPrice = null;
    this.appliedMarginPercent = null;
    this.scheduleCostCalculation();
  }

  addPrint(): void {
    const print = createEmptyEstampadoPrint();
    this.prints = [...this.prints, print];
    this.onEstampadoConfigChange();
  }

  removePrint(printId: string): void {
    this.prints = this.prints.filter((print) => print.id !== printId);
    this.onEstampadoConfigChange();
  }

  addPressCycle(): void {
    this.pressCycles = [...this.pressCycles, createEmptyEstampadoPressCycle()];
    this.onEstampadoConfigChange();
  }

  removePressCycle(cycleId: string): void {
    this.pressCycles = this.pressCycles.filter((cycle) => cycle.id !== cycleId);
    this.onEstampadoConfigChange();
  }

  onPrintPaperTypeChange(print: EstampadoPrintSpec): void {
    if (
      print.impresoId &&
      !this.filteredImpresoOptionsFor(print.paperType).some(
        (option) => option.value === print.impresoId,
      )
    ) {
      print.impresoId = undefined;
    }
    this.onEstampadoConfigChange();
  }

  onPrintImpresoChange(print: EstampadoPrintSpec): void {
    if (print.impresoId) {
      Object.assign(print, syncEstampadoPrintFromImpreso(print, this.impresos));
    }
    this.onEstampadoConfigChange();
  }

  onPrintDimensionsChange(print: EstampadoPrintSpec): void {
    if (!print.impresoId) {
      this.onEstampadoConfigChange();
      return;
    }
    const impreso = this.impresos.find((item) => item.id === print.impresoId);
    if (!impreso) {
      print.impresoId = undefined;
      this.onEstampadoConfigChange();
      return;
    }
    const matchesCatalog =
      Number(print.widthCm) === impreso.widthCm &&
      Number(print.lengthCm || 0) === Number(impreso.lengthCm || 0) &&
      Number(print.heightCm) === impreso.heightCm;
    if (!matchesCatalog) {
      print.impresoId = undefined;
    }
    this.onEstampadoConfigChange();
  }

  onEstampadoConfigChange(): void {
    this.scheduleCostCalculation();
  }

  private initEstampadoDefaults(): void {
    const print = createEmptyEstampadoPrint();
    this.prints = [print];
    this.pressCycles = [createEmptyEstampadoPressCycle()];
  }

  private buildProductSize(): string {
    if (this.isCombo) {
      return 'Combo';
    }
    if (this.isEstampado && !this.usesPieceAssembly) {
      return formatEstampadoSizeFromPrints(this.prints, this.impresos);
    }
    const formatted = formatPrintDimensionsCm(
      this.sizeWidthCm,
      this.sizeLengthCm || undefined,
      this.sizeHeightCm,
    );
    return formatted === '—' ? '' : formatted;
  }

  private applySizeFieldsFromString(size: string): void {
    const parsed = parseSizeFieldsFromString(size);
    this.sizeWidthCm = parsed.widthCm ?? 0;
    this.sizeLengthCm = parsed.lengthCm ?? 0;
    this.sizeHeightCm = parsed.heightCm ?? 0;
  }

  onProductionFieldChange(): void {
    this.scheduleCostCalculation();
  }

  onComponentsChange(): void {
    this.scheduleCostCalculation();
  }

  onCategorySelected(id: string): void {
    if (!id || this.categoryIds.includes(id) || this.categoryIds.length >= 5) {
      return;
    }
    this.categoryIds = [...this.categoryIds, id];
    this.categoryPicker = '';
  }

  removeCategory(id: string): void {
    this.categoryIds = this.categoryIds.filter((c) => c !== id);
  }

  addComponent(): void {
    if (!this.componentPicker || this.componentQty < 1) return;
    this.components = [
      ...this.components,
      { productId: this.componentPicker, quantity: Number(this.componentQty) },
    ];
    this.componentPicker = '';
    this.componentQty = 1;
    this.onComponentsChange();
  }

  removeComponent(productId: string): void {
    this.components = this.components.filter((c) => c.productId !== productId);
    this.onComponentsChange();
  }

  openCategoryForm(): void {
    this.formDialogs.openCategory(this.type).subscribe((category) => {
      if (!category) return;
      this.categoriesList = [...this.categoriesList, category];
      this.categoriesChange.emit(this.categoriesList);
      if (
        category.productTypes.includes(this.type) &&
        !this.categoryIds.includes(category.id) &&
        this.categoryIds.length < 5
      ) {
        this.categoryIds = [...this.categoryIds, category.id];
      }
      this.cdr.markForCheck();
    });
  }

  async onSubmit(): Promise<void> {
    this.imageUploadError = '';

    if (this.imageUpload?.hasPendingUploads) {
      this.savingImages = true;
      this.cdr.markForCheck();
      const uploaded = await this.imageUpload.ensureUploaded();
      this.savingImages = false;
      if (!uploaded) {
        this.imageUploadError =
          this.imageUpload.uploadError ||
          'No se pudieron subir las imágenes pendientes. Revisá la conexión e intentá de nuevo.';
        this.cdr.markForCheck();
        return;
      }
      this.images = [...this.imageUpload.files];
    }

    const payload: CreateProductPayload = {
      name: this.name.trim(),
      type: this.type,
      size: this.buildProductSize().trim(),
      price: this.finalPrice,
      cost: this.effectiveCost,
      suggestedPrice: this.suggestedPrice,
      categoryIds: this.categoryIds,
      images: this.images,
      published: this.isCombo ? true : this.published,
      includesPieces: this.isCombo || this.includesPieces,
      components: this.usesPieceAssembly ? this.components : [],
      assemblyTimeHours:
        this.usesPieceAssembly ? Number(this.assemblyTimeHours) || 0 : 0,
      ...(this.isCombo
        ? {}
        : this.is3D
          ? {
              grams: Number(this.grams) || 0,
              printTimeHours: Number(this.printTimeHours) || 0,
              workTimeHours: Number(this.workTimeHours) || 0,
              filamentType: this.isFdm ? this.filamentType : undefined,
              resinType: this.isResina ? this.resinType : undefined,
              washMinutes: this.isResina ? Number(this.washMinutes) || undefined : undefined,
              cureMinutes: this.isResina ? Number(this.cureMinutes) || undefined : undefined,
            }
          : {
              workTimeHours: Number(this.workTimeHours) || 0,
              prints: this.prints,
              pressCycles: this.pressCycles,
              supplies: this.supplyLines,
            }),
    } as CreateProductPayload;

    this.save.emit(payload);
  }

  private loadCatalog(): void {
    this.catalogService.getAllProducts(false).subscribe((products) => {
      this.catalogProducts = products;
      if (this.product) {
        this.components = normalizeProductComponents(
          this.product.components ?? [],
          this.catalogProducts,
        );
        if (this.components.length > 0) {
          this.includesPieces = true;
        }
      }
      this.cdr.markForCheck();
    });
  }

  private scheduleCostCalculation(): void {
    this.clearCostCalcTimer();
    if (!this.canAutoCalculateCost) {
      if (this.isEstampado && !this.usesPieceAssembly) {
        this.costBreakdown = null;
        if (!this.product) {
          this.cost = 0;
        }
      } else if (!this.is3D && !this.isEstampado && !this.isCombo && !this.usesPieceAssembly) {
        this.cost = 0;
        this.costBreakdown = null;
        this.computedPrice = null;
      }
      this.recalculatePriceFromCost();
      return;
    }

    this.computedPrice = null;
    this.appliedMarginPercent = null;
    this.costCalcTimer = setTimeout(() => this.calculateCost(), 500);
  }

  private clearCostCalcTimer(): void {
    if (this.costCalcTimer) {
      clearTimeout(this.costCalcTimer);
      this.costCalcTimer = null;
    }
  }

  private calculateCost(): void {
    if (this.usesPieceAssembly) {
      this.runPricingPreview();
      return;
    }

    if (!this.is3D && !this.isEstampado) return;

    if (this.is3D && Number(this.grams) <= 0) return;

    this.runPricingPreview();
  }

  private runPricingPreview(): void {
    const settings = this.settingsFacade.peekGeneralSettings();
    if (!settings) return;

    this.pricingPreviewSub?.unsubscribe();
    this.calculatingCost = true;
    this.pricingPreviewSub = this.productPricing
      .preview(this.buildPricingInput(), this.catalogProducts, settings)
      .subscribe({
        next: (result) => {
          this.costBreakdown = result.breakdown;
          const resolvedCost =
            result.cost > 0
              ? result.cost
              : result.breakdown
                ? totalCostFromBreakdown(result.breakdown)
                : 0;
          this.cost = resolvedCost;
          this.computedPrice =
            result.price > 0
              ? result.price
              : resolvedCost > 0
                ? priceFromCostAndMargin(
                    resolvedCost,
                    result.configuredMarginPercent ??
                      this.configuredProfitMargin,
                  )
                : 0;
          this.appliedMarginPercent =
            result.configuredMarginPercent ?? result.marginPercent;
          this.calculatingCost = false;
          this.pricingPreviewSub = null;
          this.cdr.markForCheck();
        },
        error: () => {
          this.recalculatePriceFromCost();
          this.calculatingCost = false;
          this.pricingPreviewSub = null;
          this.cdr.markForCheck();
        },
      });
  }

  private recalculatePriceFromCost(): void {
    const settings = this.settingsFacade.peekGeneralSettings();
    if (!settings) return;

    if (this.suggestedPrice != null && Number(this.suggestedPrice) > 0) {
      return;
    }

    if (this.usesPieceAssembly) {
      this.computedPrice = this.componentsPriceTotal;
      this.appliedMarginPercent = this.configuredProfitMargin;
      return;
    }

    const costValue = this.effectiveCost;
    if (costValue <= 0) {
      return;
    }

    const result = this.productPricing.applyMarginToCost(
      this.buildPricingInput(),
      costValue,
      this.catalogProducts,
      settings,
    );
    this.cost = costValue;
    this.computedPrice = result.price;
    this.appliedMarginPercent = result.configuredMarginPercent ?? null;
  }

  private buildPricingInput() {
    const storedCost =
      Number(this.cost) || Number(this.product?.cost) || 0;

    return {
      type: this.type,
      components: this.usesPieceAssembly ? this.components : [],
      assemblyTimeHours: Number(this.assemblyTimeHours) || 0,
      suggestedPrice: this.suggestedPrice,
      cost: storedCost,
      ...(this.isCombo
        ? {}
        : this.is3D
          ? {
              grams: Number(this.grams) || 0,
              printTimeHours: Number(this.printTimeHours) || 0,
              workTimeHours: Number(this.workTimeHours) || 0,
              filamentType: this.isFdm ? this.filamentType : undefined,
              resinType: this.isResina ? this.resinType : undefined,
              washMinutes: this.isResina ? Number(this.washMinutes) || undefined : undefined,
              cureMinutes: this.isResina ? Number(this.cureMinutes) || undefined : undefined,
            }
          : {
              workTimeHours: Number(this.workTimeHours) || 0,
              estampadoPrints: this.prints,
              estampadoPressCycles: this.pressCycles,
              estampadoSupplies: this.supplyLines,
            }),
    };
  }

  private resetForm(): void {
    if (this.product) {
      this.type = this.product.type;
      this.name = this.product.name;
      this.applySizeFieldsFromString(this.product.size);
      this.cost = this.product.cost;
      this.suggestedPrice = null;
      this.categoryIds = [...this.product.categoryIds];
      this.images = [...this.product.images];
      this.components = normalizeProductComponents(
        this.product.components ?? [],
        this.catalogProducts,
      );
      this.assemblyTimeHours = this.product.assemblyTimeHours ?? 0;
      this.published = this.product.published !== false;
      this.includesPieces =
        this.product.type === ProductType.COMBO ||
        this.product.includesPieces === true ||
        this.components.length > 0;
      if (this.product.type === ProductType.COMBO) {
        this.includesPieces = true;
      } else if (
        this.product.type === ProductType.FDM ||
        this.product.type === ProductType.RESINA
      ) {
        this.grams = this.product.grams;
        this.printTimeHours = this.product.printTimeHours;
        this.workTimeHours = this.product.workTimeHours;
        this.filamentType = this.product.filamentType ?? FilamentType.PLA;
        this.resinType = this.product.resinType ?? ResinType.ESTANDAR;
        this.washMinutes = this.product.washMinutes ?? 0;
        this.cureMinutes = this.product.cureMinutes ?? 0;
      } else {
        const estampado = this.product as ProductEstampado;
        this.workTimeHours = estampado.workTimeHours ?? 0;
        this.prints = structuredClone(
          estampado.prints?.length
            ? estampado.prints
            : [createEmptyEstampadoPrint()],
        );
        this.pressCycles = structuredClone(
          estampado.pressCycles?.length
            ? estampado.pressCycles
            : [createEmptyEstampadoPressCycle()],
        );
        this.supplyLines = structuredClone(
          estampado.supplies?.length
            ? estampado.supplies
            : [],
        );
      }
    } else {
      this.type = ProductType.FDM;
      this.name = '';
      this.sizeWidthCm = 0;
      this.sizeLengthCm = 0;
      this.sizeHeightCm = 0;
      this.cost = 0;
      this.suggestedPrice = null;
      this.categoryIds = [];
      this.images = [];
      this.components = [];
      this.assemblyTimeHours = 0;
      this.published = true;
      this.includesPieces = false;
      this.grams = 0;
      this.printTimeHours = 0;
      this.workTimeHours = 0;
      this.washMinutes = 0;
      this.cureMinutes = 0;
      this.prints = [];
      this.pressCycles = [];
      this.supplyLines = [];
      this.filamentType = FilamentType.PLA;
      this.resinType = ResinType.ESTANDAR;
    }
    this.costBreakdown = null;
    this.computedPrice = null;
    this.appliedMarginPercent = null;
    this.categoryPicker = '';
    this.componentPicker = '';
    this.componentQty = 1;
    this.scheduleCostCalculation();
  }
}
