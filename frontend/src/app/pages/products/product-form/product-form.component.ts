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
import { ReactiveFormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import {
  CreateProductPayload,
  Product,
  ProductType,
  UpdateProductPayload,
} from '../../../core/models';
import {
  DbFormComponent,
  DbFormErrorComponent,
} from '@dashboard-form';
import { DbButtonComponent } from '../../../components/db-button/db-button.component';
import { computeAssemblableUnits } from '../../../shared/utils/stock.helpers';
import { ProductFormPricingFacade } from './store/product-form-pricing/product-form-pricing.facade';
import { ProductFormFacade } from './product-form.facade';
import { ProductFormPricingService } from './product-form-pricing.service';
import { ProductFormBasicFieldsComponent, ProductFormBasicFieldsValue } from './sections/product-form-basic-fields.component';
import { ProductFormProductionFieldsComponent } from './sections/product-form-production-fields.component';
import { ProductFormComponentsSectionComponent, ProductFormComponentsValue } from './sections/product-form-components-section.component';
import { ProductFormCategoriesSectionComponent } from './sections/product-form-categories-section.component';
import { ProductFormMediaSectionComponent } from './sections/product-form-media-section.component';
import { ProductFormPricingSectionComponent } from './sections/product-form-pricing-section.component';

@Component({
  selector: 'app-product-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    DbFormComponent,
    DbFormErrorComponent,
    DbButtonComponent,
    ProductFormBasicFieldsComponent,
    ProductFormProductionFieldsComponent,
    ProductFormComponentsSectionComponent,
    ProductFormCategoriesSectionComponent,
    ProductFormMediaSectionComponent,
    ProductFormPricingSectionComponent,
  ],
  providers: [ProductFormFacade, ProductFormPricingService],
  templateUrl: './product-form.component.html',
  styleUrl: './product-form.component.scss',
})
export class ProductFormComponent implements OnInit, OnChanges, OnDestroy {
  readonly facade = inject(ProductFormFacade);
  private readonly pricingStore = inject(ProductFormPricingFacade);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();

  @Input() product: Product | null = null;
  @Input() loading = false;
  @Input() error = '';
  clientError = '';
  @Output() save = new EventEmitter<CreateProductPayload | UpdateProductPayload>();
  @Output() cancel = new EventEmitter<void>();

  @ViewChild('mediaSection')
  private mediaSection?: ProductFormMediaSectionComponent;

  @ViewChild(ProductFormBasicFieldsComponent)
  private basicFieldsSection?: ProductFormBasicFieldsComponent;

  @ViewChild(ProductFormComponentsSectionComponent)
  private componentsSection?: ProductFormComponentsSectionComponent;

  @ViewChild(ProductFormCategoriesSectionComponent)
  private categoriesSection?: ProductFormCategoriesSectionComponent;

  basicFields: ProductFormBasicFieldsValue | null = null;
  categoryIds: string[] | null = null;
  componentsValue: ProductFormComponentsValue | null = null;

  get productType(): ProductType {
    return this.basicFields?.type ?? this.facade.type;
  }

  get missingFields(): string[] {
    const missing: string[] = [];
    if (!this.facade.form.controls.name.value.trim()) missing.push('nombre');
    if (this.facade.categoryIds.length < 1) missing.push('una categoría');
    if (this.facade.is3D && this.facade.showProductionFields) {
      if (!(Number(this.facade.form.controls.printTimeHours.value) > 0)) {
        missing.push('horas de impresión');
      }
      if (!(Number(this.facade.form.controls.workTimeHours.value) > 0)) {
        missing.push('mano de obra');
      }
    }
    return missing;
  }

  get suggestedFinishedStock(): number {
    return computeAssemblableUnits(
      {
        id: this.product?.id ?? '__draft-product__',
        type: this.productType,
        includesPieces: true,
        components: this.facade.components,
        stock: 0,
        finishedStock: 0,
      },
      this.facade.catalogProducts,
    );
  }

  ngOnInit(): void {
    this.facade.init(this.product);
    this.syncBasicFields();
    this.syncCategoryIds();
    this.syncComponentsValue();
    this.facade.form.controls.includesPieces.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.cdr.markForCheck());
    this.facade.form.controls.components.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.cdr.markForCheck());
    this.facade.basicFieldsSync$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.syncBasicFields();
        this.cdr.markForCheck();
      });
    this.facade.categoryIdsSync$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.syncCategoryIds();
        this.cdr.markForCheck();
      });
    this.facade.componentsSync$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.syncComponentsValue();
        this.cdr.markForCheck();
      });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['product'] && !changes['product'].firstChange) {
      this.facade.setProduct(this.product);
      this.syncBasicFields();
      this.syncCategoryIds();
      this.syncComponentsValue();
    }
  }

  onBasicFieldsChange(value: ProductFormBasicFieldsValue): void {
    const previousType = this.basicFields?.type;
    this.basicFields = value;
    this.facade.patchBasicFields(value);
    if (previousType !== value.type) {
      this.pricingStore.setProductType(value.type);
    }
    this.syncComponentsValue();
    this.cdr.markForCheck();
  }

  onCategoriesChange(categoryIds: string[]): void {
    this.categoryIds = categoryIds;
    this.facade.patchCategoryIds(categoryIds);
  }

  onComponentsChange(value: ProductFormComponentsValue): void {
    this.componentsValue = value;
    this.facade.patchComponentsValue(value);
  }

  private syncBasicFields(): void {
    this.basicFields = this.facade.basicFieldsValue;
  }

  private syncCategoryIds(): void {
    this.categoryIds = this.facade.categoryIdsValue;
  }

  private syncComponentsValue(): void {
    this.componentsValue = this.facade.componentsValue;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.facade.destroy();
  }

  async onSubmit(): Promise<void> {
    if (!(await this.mediaSection?.ensureUploads())) {
      return;
    }

    this.flushSectionValues();
    const materialError = this.facade.printedMaterialError;
    if (materialError) {
      this.clientError = materialError;
      this.cdr.markForCheck();
      return;
    }

    this.clientError = '';
    this.save.emit(this.facade.buildSubmitPayload());
  }

  private flushSectionValues(): void {
    if (this.basicFieldsSection) {
      this.facade.patchBasicFields(this.basicFieldsSection.readValue());
    }

    this.facade.patchComponentsValue(
      this.componentsSection?.readValue() ?? this.facade.componentsValue,
    );

    if (this.categoriesSection) {
      this.facade.patchCategoryIds(this.categoriesSection.readValue());
    }
  }
}
