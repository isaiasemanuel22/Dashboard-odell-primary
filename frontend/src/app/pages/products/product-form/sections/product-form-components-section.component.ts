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
  ColorConfig,
  GeneralSettings,
  INDISTINTO_COLOR_ID,
  Product,
  ProductComponent,
  ProductType,
  Supply,
} from '../../../../core/models';
import { CatalogFacade } from '../../../../store/catalog/catalog.facade';
import { SettingsFacade } from '../../../../store/settings/settings.facade';
import { SuppliesService } from '../../../../core/services/settings.service';
import { ProductFormPricingFacade } from '../store/product-form-pricing/product-form-pricing.facade';
import {
  sumComponentsCost,
  sumComponentsPrice,
} from '../../../../shared/utils/product.helpers';
import { ProductComponentsTableComponent } from '../../../../components/product-components-table/product-components-table.component';
import { DbButtonComponent } from '../../../../components/db-button/db-button.component';
import {
  DbFieldsetComponent,
  DbInputComponent,
  DbSelectComponent,
} from '@dashboard-form';
import type { DbSelectOption } from '@dashboard-form';
import { productComponentSelectLabel } from '../../../../shared/utils/product.helpers';

export interface ProductFormComponentsValue {
  components: ProductComponent[];
  assemblyTimeHours: number;
}

@Component({
  selector: 'app-product-form-components-section',
  standalone: true,
  imports: [
    FormsModule,
    DbFieldsetComponent,
    DbSelectComponent,
    DbInputComponent,
    DbButtonComponent,
    ProductComponentsTableComponent,
  ],
  templateUrl: './product-form-components-section.component.html',
  styleUrl: '../product-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductFormComponentsSectionComponent implements OnInit, OnDestroy {
  private readonly catalogFacade = inject(CatalogFacade);
  private readonly settingsFacade = inject(SettingsFacade);
  private readonly suppliesService = inject(SuppliesService);
  private readonly pricingStore = inject(ProductFormPricingFacade);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();

  @Input() productType: ProductType = ProductType.FDM;
  @Input() editingProductId: string | null = null;
  @Output() readonly valueChange = new EventEmitter<ProductFormComponentsValue>();

  catalogProducts: Product[] = [];
  components: ProductComponent[] = [];
  colorCatalog: ColorConfig[] = [];
  supplies: Supply[] = [];
  assemblyTimeHours = 0;
  componentPicker = '';
  componentQty = 1;
  catalogLoading = true;

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
        this.cdr.markForCheck();
      });

    this.settingsFacade
      .watchGeneralSettings()
      .pipe(takeUntil(this.destroy$))
      .subscribe((settings: GeneralSettings | null) => {
        this.colorCatalog = settings?.colors ?? [];
        this.cdr.markForCheck();
      });

    this.suppliesService
      .watchSupplies()
      .pipe(takeUntil(this.destroy$))
      .subscribe((items) => {
        this.supplies = items;
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

  get availableComponentOptions(): DbSelectOption[] {
    const used = new Set(this.components.map((component) => component.productId));
    return this.catalogProducts
      .filter(
        (product) =>
          product.id !== this.editingProductId && !used.has(product.id),
      )
      .map((product) => ({
        value: product.id,
        label: productComponentSelectLabel(product),
      }));
  }

  get canAddComponent(): boolean {
    return this.availableComponentOptions.length > 0 && this.componentQty >= 1;
  }

  get pickerHint(): string {
    if (this.catalogLoading && !this.catalogProducts.length) {
      return 'Cargando productos disponibles...';
    }
    if (!this.availableComponentOptions.length) {
      if (this.editingProductId && this.catalogProducts.length <= 1) {
        return 'Necesitás al menos otro producto en el catálogo para usarlo como pieza.';
      }
      return 'No quedan productos disponibles para agregar.';
    }
    return '';
  }

  addComponent(): void {
    if (!this.componentPicker || this.componentQty < 1) {
      return;
    }

    this.components = [
      ...this.components,
      {
        productId: this.componentPicker,
        quantity: Number(this.componentQty),
        colorId: INDISTINTO_COLOR_ID,
      },
    ];
    this.componentPicker = '';
    this.componentQty = 1;
    this.emitIfLoaded();
  }

  updateComponentColor(productId: string, colorId: string): void {
    this.components = this.components.map((component) =>
      component.productId === productId
        ? { ...component, colorId }
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
