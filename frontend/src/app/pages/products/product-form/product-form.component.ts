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
  DbFormFooterComponent,
  DbButtonComponent,
} from '@general-components';
import { ProductFormPricingFacade } from '../../../store/product-form-pricing/product-form-pricing.facade';
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
    DbFormFooterComponent,
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

  get showComponentsSection(): boolean {
    const includesPieces =
      this.basicFields?.includesPieces ?? this.facade.includesPieces;
    return this.productType === ProductType.COMBO || includesPieces;
  }

  ngOnInit(): void {
    this.facade.init(this.product);
    this.syncBasicFields();
    this.syncCategoryIds();
    this.syncComponentsValue();
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
    this.save.emit(this.facade.buildSubmitPayload());
  }

  private flushSectionValues(): void {
    if (this.basicFieldsSection) {
      this.facade.patchBasicFields(this.basicFieldsSection.readValue());
    }

    if (this.componentsSection) {
      this.facade.patchComponentsValue(this.componentsSection.readValue());
    }

    if (this.categoriesSection) {
      this.facade.patchCategoryIds(this.categoriesSection.readValue());
    }
  }
}
