import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import {
  Category,
  ColorConfig,
  GeneralSettings,
  INDISTINTO_COLOR_ID,
  Product,
  ProductComponent,
  ProductType,
} from '../../../../core/models';
import { CatalogFacade } from '../../../../store/catalog/catalog.facade';
import { SettingsFacade } from '../../../../store/settings/settings.facade';
import { ProductFormPricingFacade } from '../store/product-form-pricing/product-form-pricing.facade';
import {
  sumComponentsCost,
  sumComponentsPrice,
} from '../../../../shared/utils/product.helpers';
import { computeAssemblableUnits } from '../../../../shared/utils/stock.helpers';
import { CurrencyArsPipe } from '../../../../shared/pipes/labels.pipe';
import { ProductComponentsTableComponent } from '../../../../components/product-components-table/product-components-table.component';
import { ProductPiecePickerComponent } from '../../../../components/product-piece-picker/product-piece-picker.component';
import {
  DbCheckboxComponent,
  DbInputComponent,
} from '@dashboard-form';

export interface ProductFormComponentsValue {
  components: ProductComponent[];
  assemblyTimeHours: number;
}

@Component({
  selector: 'app-product-form-components-section',
  standalone: true,
  imports: [
    FormsModule,
    DbInputComponent,
    DbCheckboxComponent,
    CurrencyArsPipe,
    ProductComponentsTableComponent,
    ProductPiecePickerComponent,
  ],
  templateUrl: './product-form-components-section.component.html',
  styleUrl: '../product-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductFormComponentsSectionComponent implements OnInit, OnDestroy {
  private readonly catalogFacade = inject(CatalogFacade);
  private readonly settingsFacade = inject(SettingsFacade);
  private readonly pricingStore = inject(ProductFormPricingFacade);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();

  @Input() productType: ProductType = ProductType.FDM;
  @Input() editingProductId: string | null = null;
  @Output() readonly valueChange = new EventEmitter<ProductFormComponentsValue>();

  catalogProducts: Product[] = [];
  categories: Category[] = [];
  components: ProductComponent[] = [];
  colorCatalog: ColorConfig[] = [];
  assemblyTimeHours = 0;
  catalogLoading = true;
  /** UI del mock: refleja el comportamiento actual (siempre se descuentan piezas). */
  deductPiecesOnSale = true;
  laborCostPerHour = 0;

  private ready = false;
  private lastEmitted: ProductFormComponentsValue | null = null;

  @Input() set value(v: ProductFormComponentsValue | null) {
    if (!v) {
      return;
    }

    if (!this.isSameValue(v, this.currentValue())) {
      this.components = [...v.components];
      this.assemblyTimeHours = v.assemblyTimeHours;
    }

    this.lastEmitted = {
      components: [...v.components],
      assemblyTimeHours: v.assemblyTimeHours,
    };
    this.ready = true;
    this.cdr.markForCheck();
  }

  ngOnInit(): void {
    this.catalogFacade.loadAllProducts(true);
    this.catalogFacade.load(false);
    this.catalogFacade.allProductsLoading$
      .pipe(takeUntil(this.destroy$))
      .subscribe((loading) => {
        this.catalogLoading = loading;
        this.cdr.markForCheck();
      });
    this.catalogFacade.allProductsLoaded$
      .pipe(takeUntil(this.destroy$))
      .subscribe((loaded) => {
        if (loaded) {
          this.catalogLoading = false;
          this.cdr.markForCheck();
        }
      });
    this.catalogFacade.allProducts$
      .pipe(takeUntil(this.destroy$))
      .subscribe((products) => {
        this.catalogProducts = products;
        this.syncPricingContributions();
        this.cdr.markForCheck();
      });
    this.catalogFacade.categories$
      .pipe(takeUntil(this.destroy$))
      .subscribe((categories) => {
        this.categories = categories;
        this.cdr.markForCheck();
      });

    this.settingsFacade
      .watchGeneralSettings()
      .pipe(takeUntil(this.destroy$))
      .subscribe((settings: GeneralSettings | null) => {
        this.colorCatalog = settings?.colors ?? [];
        this.laborCostPerHour = Number(settings?.laborCostPerHour) || 0;
        this.cdr.markForCheck();
      });

    queueMicrotask(() => {
      if (!this.ready) {
        this.ready = true;
        this.cdr.markForCheck();
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get isEstampado(): boolean {
    return this.productType === ProductType.ESTAMPADO;
  }

  get excludeIds(): string[] {
    const ids = this.components.map((component) => component.productId);
    if (this.editingProductId) ids.push(this.editingProductId);
    return ids;
  }

  get distinctCount(): number {
    return this.components.length;
  }

  get totalUnits(): number {
    return this.components.reduce(
      (sum, item) => sum + Math.max(1, Math.trunc(Number(item.quantity) || 1)),
      0,
    );
  }

  get partsCost(): number {
    return sumComponentsCost(this.catalogProducts, this.components);
  }

  get assemblableUnits(): number {
    return computeAssemblableUnits(
      {
        id: this.editingProductId ?? '__draft-product__',
        type: this.productType,
        includesPieces: true,
        components: this.components,
        stock: 0,
        finishedStock: 0,
      },
      this.catalogProducts,
    );
  }

  get assemblyHint(): string {
    const rate = new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0,
    }).format(this.laborCostPerHour || 0);
    return `Encastrar, revisar y empacar - ${rate}/h`;
  }

  addPiece(productId: string): void {
    if (!productId) return;
    if (this.components.some((component) => component.productId === productId)) {
      return;
    }

    this.components = [
      ...this.components,
      {
        productId,
        quantity: 1,
        colorId: INDISTINTO_COLOR_ID,
      },
    ];
    this.emitIfLoaded();
  }

  onPieceCreated(product: Product): void {
    if (!this.catalogProducts.some((item) => item.id === product.id)) {
      this.catalogProducts = [...this.catalogProducts, product];
    }
    this.cdr.markForCheck();
  }

  updateComponentColor(productId: string, colorId: string): void {
    this.components = this.components.map((component) =>
      component.productId === productId
        ? { ...component, colorId }
        : component,
    );
    this.emitIfLoaded();
  }

  updateComponentQuantity(productId: string, quantity: number): void {
    const next = Math.max(1, Math.floor(Number(quantity) || 1));
    this.components = this.components.map((component) =>
      component.productId === productId
        ? { ...component, quantity: next }
        : component,
    );
    this.emitIfLoaded();
  }

  removeComponent(productId: string): void {
    this.components = this.components.filter(
      (component) => component.productId !== productId,
    );
    this.emitIfLoaded();
  }

  onFieldChange(): void {
    this.emitIfLoaded();
  }

  readValue(): ProductFormComponentsValue {
    return this.currentValue();
  }

  private currentValue(): ProductFormComponentsValue {
    return {
      components: [...this.components],
      assemblyTimeHours: this.assemblyTimeHours,
    };
  }

  private emitIfLoaded(): void {
    if (!this.ready) {
      return;
    }

    const next = this.currentValue();
    if (this.isSameValue(next, this.lastEmitted)) {
      return;
    }

    this.lastEmitted = next;
    this.syncPricingContributions();
    this.valueChange.emit(next);
    this.cdr.markForCheck();
  }

  private syncPricingContributions(): void {
    const partsCost = sumComponentsCost(this.catalogProducts, this.components);
    const partsPrice = sumComponentsPrice(this.catalogProducts, this.components);
    this.pricingStore.setCostContribution('components', partsCost);
    this.pricingStore.setComponentsPrice(partsPrice);
  }

  private isSameValue(
    a: ProductFormComponentsValue,
    b: ProductFormComponentsValue | null,
  ): boolean {
    if (!b) {
      return false;
    }

    if (a.assemblyTimeHours !== b.assemblyTimeHours) {
      return false;
    }

    if (a.components.length !== b.components.length) {
      return false;
    }

    return a.components.every(
      (component, index) =>
        component.productId === b.components[index]?.productId &&
        component.quantity === b.components[index]?.quantity &&
        (component.colorId ?? INDISTINTO_COLOR_ID) ===
          (b.components[index]?.colorId ?? INDISTINTO_COLOR_ID),
    );
  }
}
