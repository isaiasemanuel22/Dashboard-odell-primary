import {
  Component,
  EventEmitter,
  HostListener,
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
import { BreakpointService } from '../../../core/services/breakpoint.service';
import { PRODUCT_TYPE_LABELS } from '../../../shared/constants/labels';
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

type AccordionKey = 'datos' | 'piezas' | 'produccion' | 'media' | 'precio';

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
  styleUrls: ['./product-form.component.scss', './product-form.mobile.scss'],
})
export class ProductFormComponent implements OnInit, OnChanges, OnDestroy {
  readonly facade = inject(ProductFormFacade);
  private readonly pricingStore = inject(ProductFormPricingFacade);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly breakpoint = inject(BreakpointService);
  private readonly destroy$ = new Subject<void>();

  readonly isMobile = this.breakpoint.isMobile;

  @Input() product: Product | null = null;
  @Input() loading = false;
  @Input() error = '';
  /** En mobile el pie vive en `db-mobile-form-shell` / dock. */
  @Input() hideFooter = false;
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

  accDatos = true;
  accPiezas = false;
  accProduccion = false;
  accMedia = false;
  accPrecio = true;

  /** True tras interacción del usuario; ignora la carga inicial del producto. */
  private userEdited = false;

  /** True si el usuario tocó el form y se perderían cambios al cerrar. */
  hasUnsavedChanges(): boolean {
    return this.userEdited;
  }

  @HostListener('input')
  @HostListener('change')
  onFormFieldEdit(): void {
    this.userEdited = true;
  }

  @HostListener('click', ['$event'])
  onFormClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (target.closest('[data-discard-safe]')) return;
    if (
      target.closest(
        'button, [role="button"], input, select, textarea, .type-switch__item, .pf-m-acc__h',
      )
    ) {
      this.userEdited = true;
    }
  }

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
    this.facade.form.valueChanges
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

  selectMobileType(type: ProductType): void {
    const current =
      this.basicFieldsSection?.readValue() ??
      this.basicFields ??
      this.facade.basicFieldsValue;
    this.onBasicFieldsChange({ ...current, type });
  }

  shortTypeLabel(type: ProductType): string {
    return PRODUCT_TYPE_LABELS[type] ?? type;
  }

  toggleAcc(key: AccordionKey): void {
    if (!this.isMobile()) return;
    switch (key) {
      case 'datos':
        this.accDatos = !this.accDatos;
        break;
      case 'piezas':
        this.accPiezas = !this.accPiezas;
        break;
      case 'produccion':
        this.accProduccion = !this.accProduccion;
        break;
      case 'media':
        this.accMedia = !this.accMedia;
        break;
      case 'precio':
        this.accPrecio = !this.accPrecio;
        break;
    }
    this.cdr.markForCheck();
  }

  get productionSummary(): string {
    const grams = Number(this.facade.form.controls.grams.value) || 0;
    const hours = Number(this.facade.form.controls.printTimeHours.value) || 0;
    const parts: string[] = [];
    if (grams > 0) parts.push(`${grams} g`);
    if (hours > 0) parts.push(`${hours} h`);
    return parts.join(' · ') || 'Sin datos';
  }

  get mediaSummary(): string {
    const images = this.facade.form.controls.images.value?.length ?? 0;
    const files = this.facade.form.controls.attachments.value?.length ?? 0;
    const parts: string[] = [];
    if (images > 0) {
      parts.push(images === 1 ? '1 foto' : `${images} fotos`);
    }
    if (files > 0) {
      parts.push(files === 1 ? '1 archivo' : `${files} archivos`);
    }
    return parts.join(' · ') || 'Sin archivos';
  }

  get componentsSummary(): string {
    const n = this.facade.components.length;
    if (n <= 0) return 'Sin piezas';
    return n === 1 ? '1 pieza' : `${n} piezas`;
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
