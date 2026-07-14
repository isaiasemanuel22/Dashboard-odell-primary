import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  ChangeDetectorRef,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import {
  Category,
  CostBreakdown,
  CreateProductPayload,
  FilamentType,
  Product,
  ProductComponent,
  ProductType,
  ResinType,
  UpdateProductPayload,
  isProductType3D,
} from '../../../core/models';
import { ProductCatalogService } from '../../../core/services/product-catalog.service';
import { MediaUploadService } from '../../../core/services/media-upload.service';
import { ProductsService } from '../../../core/services/products.service';
import { extractApiErrorMessage } from '../../../shared/utils/api-error';
import {
  productComponentSelectLabel,
  sumComponentsCost,
  sumComponentsPrice,
} from '../../../shared/utils/product.helpers';
import {
  filamentTypeOptions,
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

  readonly productTypeOptions = productTypeOptions();
  readonly filamentTypeOptions = filamentTypeOptions();
  readonly resinTypeOptions = resinTypeOptions();

  categoriesList: Category[] = [];
  catalogProducts: Product[] = [];
  categoryPicker = '';

  type = ProductType.FDM;
  name = '';
  size = '';
  cost = 0;
  suggestedPrice: number | null = null;
  categoryIds: string[] = [];
  images: string[] = [];
  grams = 0;
  printTimeHours = 0;
  workTimeHours = 0;
  washMinutes = 0;
  cureMinutes = 0;
  pressMinutes = 0;
  filamentType = FilamentType.PLA;
  resinType = ResinType.ESTANDAR;
  components: ProductComponent[] = [];
  assemblyTimeHours = 0;
  published = true;
  componentPicker = '';
  componentQty = 1;
  costBreakdown: CostBreakdown | null = null;
  calculatingCost = false;
  computedPrice: number | null = null;

  private costCalcTimer: ReturnType<typeof setTimeout> | null = null;

  readonly uploadProductImage: DbFileUploadFn = (file) =>
    firstValueFrom(this.mediaUpload.uploadProductImage(file));

  ngOnInit(): void {
    this.categoriesList = [...this.categories];
    this.loadCatalog();
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
    this.clearCostCalcTimer();
  }

  get isEstampado(): boolean {
    return this.type === ProductType.ESTAMPADO;
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

  get finalPrice(): number {
    if (this.suggestedPrice != null && Number(this.suggestedPrice) > 0) {
      return Number(this.suggestedPrice);
    }
    if (this.hasComponents) {
      return this.componentsPriceTotal;
    }
    if (this.computedPrice != null && this.computedPrice > 0) {
      return this.computedPrice;
    }
    if (this.product) {
      return this.product.price;
    }
    return this.cost;
  }

  get profit(): number {
    return this.finalPrice - (Number(this.cost) || 0);
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

  get sizePlaceholder(): string {
    return this.is3D
      ? 'Ej: 12 × 8 × 5 cm'
      : 'Ej: 20 × 25 cm (área del diseño)';
  }

  get canAutoCalculateCost(): boolean {
    if (this.hasComponents) return this.components.length > 0;
    if (this.isEstampado) {
      return Number(this.pressMinutes) > 0 || Number(this.workTimeHours) > 0;
    }
    if (!this.is3D) return false;
    return Number(this.grams) > 0;
  }

  onTypeChange(): void {
    this.categoryIds = this.categoryIds.filter((id) =>
      this.filteredCategories.some((c) => c.id === id),
    );
    this.categoryPicker = '';
    this.costBreakdown = null;
    this.scheduleCostCalculation();
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

  onSubmit(): void {
    const payload: CreateProductPayload = {
      name: this.name.trim(),
      type: this.type,
      size: this.size.trim(),
      price: this.finalPrice,
      cost: Number(this.cost),
      suggestedPrice: this.suggestedPrice,
      categoryIds: this.categoryIds,
      images: this.images,
      published: this.published,
      components: this.components,
      assemblyTimeHours: Number(this.assemblyTimeHours) || 0,
      ...(this.is3D
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
            pressMinutes: Number(this.pressMinutes) || undefined,
            workTimeHours: Number(this.workTimeHours) || 0,
          }),
    } as CreateProductPayload;

    this.save.emit(payload);
  }

  private loadCatalog(): void {
    this.catalogService.getAllProducts(true).subscribe((products) => {
      this.catalogProducts = products;
    });
  }

  private scheduleCostCalculation(): void {
    this.clearCostCalcTimer();
    if (!this.canAutoCalculateCost) {
      if (!this.is3D && !this.isEstampado && !this.hasComponents) {
        this.cost = 0;
        this.costBreakdown = null;
      }
      return;
    }

    this.costCalcTimer = setTimeout(() => this.calculateCost(), 350);
  }

  private clearCostCalcTimer(): void {
    if (this.costCalcTimer) {
      clearTimeout(this.costCalcTimer);
      this.costCalcTimer = null;
    }
  }

  private calculateCost(): void {
    if (this.hasComponents) {
      this.runPricingPreview();
      return;
    }

    if (!this.is3D && !this.isEstampado) return;

    if (this.is3D && Number(this.grams) <= 0) return;

    this.runPricingPreview();
  }

  private runPricingPreview(): void {
    this.calculatingCost = true;
    this.productsService.previewPricing(this.buildPricingInput()).subscribe({
      next: (result) => {
        this.costBreakdown = result.breakdown;
        this.cost = result.cost;
        this.computedPrice = result.price;
        this.calculatingCost = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.calculatingCost = false;
        this.cdr.markForCheck();
      },
    });
  }

  private buildPricingInput() {
    return {
      type: this.type,
      components: this.components,
      assemblyTimeHours: Number(this.assemblyTimeHours) || 0,
      suggestedPrice: this.suggestedPrice,
      price: this.product?.price ?? (Number(this.cost) || 0),
      cost: Number(this.cost) || 0,
      ...(this.is3D
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
            pressMinutes: Number(this.pressMinutes) || undefined,
            workTimeHours: Number(this.workTimeHours) || 0,
          }),
    };
  }

  private resetForm(): void {
    if (this.product) {
      this.type = this.product.type;
      this.name = this.product.name;
      this.size = this.product.size;
      this.cost = this.product.cost;
      this.suggestedPrice = null;
      this.categoryIds = [...this.product.categoryIds];
      this.images = [...this.product.images];
      this.components = [...(this.product.components ?? [])];
      this.assemblyTimeHours = this.product.assemblyTimeHours ?? 0;
      this.published = this.product.published !== false;
      if ('grams' in this.product) {
        this.grams = this.product.grams;
        this.printTimeHours = this.product.printTimeHours;
        this.workTimeHours = this.product.workTimeHours;
        this.filamentType = this.product.filamentType ?? FilamentType.PLA;
        this.resinType = this.product.resinType ?? ResinType.ESTANDAR;
        this.washMinutes = this.product.washMinutes ?? 0;
        this.cureMinutes = this.product.cureMinutes ?? 0;
      } else {
        this.pressMinutes = this.product.pressMinutes ?? 0;
        this.workTimeHours = this.product.workTimeHours ?? 0;
      }
    } else {
      this.type = ProductType.FDM;
      this.name = '';
      this.size = '';
      this.cost = 0;
      this.suggestedPrice = null;
      this.categoryIds = [];
      this.images = [];
      this.components = [];
      this.assemblyTimeHours = 0;
      this.published = true;
      this.grams = 0;
      this.printTimeHours = 0;
      this.workTimeHours = 0;
      this.washMinutes = 0;
      this.cureMinutes = 0;
      this.pressMinutes = 0;
      this.filamentType = FilamentType.PLA;
      this.resinType = ResinType.ESTANDAR;
    }
    this.costBreakdown = null;
    this.computedPrice = null;
    this.categoryPicker = '';
    this.componentPicker = '';
    this.componentQty = 1;
    this.scheduleCostCalculation();
  }
}
