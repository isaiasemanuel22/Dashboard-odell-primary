import {
  Component,
  DestroyRef,
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
  ElementRef,
  inject,
} from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { Subject, takeUntil } from 'rxjs';
import {
  CreateProductPayload,
  MachineProfileRole,
  Product,
  ProductAttachment,
  ProductType,
  UpdateProductPayload,
} from '../../../core/models';
import {
  DbFormComponent,
  DbFormErrorComponent,
} from '@dashboard-form';
import type { DbSelectOption } from '@dashboard-form';
import { DbButtonComponent } from '../../../components/db-button/db-button.component';
import { BreakpointService } from '../../../core/services/breakpoint.service';
import { PRODUCT_TYPE_LABELS } from '../../../shared/constants/labels';
import { computeAssemblableUnits } from '../../../shared/utils/stock.helpers';
import { getMachineProfilesForProductType } from '../../../shared/utils/machine-profile.util';
import { SettingsFacade } from '../../../store/settings/settings.facade';
import { ProductFormFacade } from './product-form.facade';
import { ProductFormPricingService } from './product-form-pricing.service';
import { ProductFormPricingFacade } from './store/product-form-pricing/product-form-pricing.facade';
import { formatCurrencyArs } from '../../../shared/utils/currency-ars.util';
import { markupPercentOnCostRounded } from '../../../shared/utils/product-margin.util';
import { ProductFormBasicFieldsComponent, ProductFormBasicFieldsValue } from './sections/product-form-basic-fields.component';
import { ProductFormProductionFieldsComponent } from './sections/product-form-production-fields.component';
import { ProductFormComponentsSectionComponent, ProductFormComponentsValue } from './sections/product-form-components-section.component';
import { ProductFormCategoriesSectionComponent } from './sections/product-form-categories-section.component';
import { ProductFormMediaSectionComponent } from './sections/product-form-media-section.component';
import { ProductFormPricingSectionComponent } from './sections/product-form-pricing-section.component';
import {
  ProductForm3mfImportComponent,
  ProductForm3mfApplyPayload,
} from './sections/product-form-3mf-import/product-form-3mf-import.component';
import { apply3mfResultToProductForm } from './product-form-3mf-apply';

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
    ProductForm3mfImportComponent,
  ],
  providers: [ProductFormFacade, ProductFormPricingService],
  templateUrl: './product-form.component.html',
  styleUrls: ['./product-form.component.scss', './product-form.mobile.scss'],
})
export class ProductFormComponent implements OnInit, OnChanges, OnDestroy {
  readonly facade = inject(ProductFormFacade);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly breakpoint = inject(BreakpointService);
  private readonly settingsFacade = inject(SettingsFacade);
  private readonly destroyRef = inject(DestroyRef);
  private readonly destroy$ = new Subject<void>();

  private readonly pricingService = inject(ProductFormPricingService);
  private readonly pricingStore = inject(ProductFormPricingFacade);
  private readonly pricingVm = toSignal(this.pricingStore.vm$, {
    initialValue: null,
  });

  readonly isMobile = this.breakpoint.isMobile;
  preferredPrinterOptions: DbSelectOption[] = [
    { value: '', label: 'Cualquiera (la que termine antes)' },
  ];
  /** Campos aún marcados como venidos del .3mf (hasta que el usuario los edite). */
  sourcedFrom3mf = {
    filaments: false,
    printHours: false,
    purge: false,
  };
  /** .3mf leído en esta sesión (aún no necesariamente persistido). */
  private sessionHas3mf = false;
  private applying3mf = false;

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
    if (!this.userEdited) return false;
    // Un click sin cambio real (o la carga inicial) no cuenta como modificación.
    return this.snapshot() !== this.baseline;
  }

  private baseline = '';

  private snapshot(): string {
    const { categoryPicker, componentPicker, componentQty, ...rest } =
      this.facade.form.getRawValue();
    void categoryPicker;
    void componentPicker;
    void componentQty;
    return JSON.stringify([rest, this.facade.usesCalculatedPrice]);
  }

  private captureBaseline(): void {
    if (!this.userEdited) this.baseline = this.snapshot();
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

  /**
   * Precio de venta y margen para la barra fija mobile («Guardar cambios · $ X»).
   * Mismo precio que muestra el panel de precio (manual o conservado si aplica).
   */
  get dockPriceSummary(): { price: number; label: string; margin: number | null } | null {
    const vm = this.pricingVm();
    if (!vm || !(vm.price > 0)) return null;
    const manual = Number(this.pricingService.manualUnitPrice) || 0;
    let price = vm.price;
    if (manual > 0) {
      price = manual;
    } else {
      const held = this.pricingService.heldCatalogPrice();
      const next = Math.round(Number(this.pricingService.computedPrice) || vm.price);
      if (held != null && next > 0 && next !== held) price = held;
    }
    const margin = markupPercentOnCostRounded(
      price,
      vm.totalCost,
      vm.costBreakdown?.laborCost ?? 0,
    );
    return { price, label: formatCurrencyArs(Math.round(price)), margin };
  }

  get missingFields(): string[] {
    const missing: string[] = [];
    if (!this.facade.form.controls.name.value.trim()) missing.push('nombre');
    if (this.facade.categoryIds.length < 1) missing.push('una categoría');
    missing.push(...this.facade.missingRequiredFields);
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

  /** Abre los bloques de costo cerrados (Impresión, Mano de obra, Insumos). */
  private openCostBlocks(titles: string[]): void {
    if (titles.length) this.accProduccion = true;
    this.cdr.markForCheck();
    setTimeout(() => {
      const blocks = this.host.nativeElement.querySelectorAll<HTMLDetailsElement>(
        'details.cost-composition__block',
      );
      blocks.forEach((block) => {
        const title = block
          .querySelector('.cost-composition__summary-title')
          ?.textContent?.trim();
        if (title && titles.includes(title)) block.open = true;
      });
    }, 0);
  }

  private openBlocksForMissing(): void {
    const titles: string[] = [];
    for (const item of this.missingFields) {
      if (item === 'horas de impresión') titles.push('Impresión');
      if (item === 'mano de obra') titles.push('Mano de obra');
    }
    if (this.facade.missingRequiredFields.length) this.accProduccion = true;
    if (titles.length) this.openCostBlocks(titles);
  }

  ngOnInit(): void {
    this.facade.init(this.product);
    if (!this.product) {
      this.openCostBlocks(['Impresión', 'Mano de obra', 'Insumos']);
    }
    this.syncBasicFields();
    this.syncCategoryIds();
    this.syncComponentsValue();
    this.settingsFacade
      .watchUntilDestroyed(this.destroyRef)
      .subscribe((settings) => {
        if (!settings) return;
        const printers = getMachineProfilesForProductType(
          settings,
          ProductType.FDM,
        ).filter(
          (p) => p.role === MachineProfileRole.PRINT && !!p.queueEnabled,
        );
        this.preferredPrinterOptions = [
          { value: '', label: 'Cualquiera (la que termine antes)' },
          ...printers.map((p) => ({ value: p.id, label: p.name })),
        ];
        this.cdr.markForCheck();
      });
    this.settingsFacade.ensureLoaded().subscribe();
    this.facade.form.controls.includesPieces.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.cdr.markForCheck());
    this.facade.form.controls.components.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.cdr.markForCheck());
    this.facade.form.controls.filamentLines.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (!this.applying3mf && this.sourcedFrom3mf.filaments) {
          this.sourcedFrom3mf = { ...this.sourcedFrom3mf, filaments: false };
        }
        this.cdr.markForCheck();
      });
    this.facade.form.controls.printTimeHours.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (!this.applying3mf && this.sourcedFrom3mf.printHours) {
          this.sourcedFrom3mf = { ...this.sourcedFrom3mf, printHours: false };
        }
        this.cdr.markForCheck();
      });
    this.facade.form.controls.purgeGrams.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (!this.applying3mf && this.sourcedFrom3mf.purge) {
          this.sourcedFrom3mf = { ...this.sourcedFrom3mf, purge: false };
        }
        this.cdr.markForCheck();
      });
    this.facade.form.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.captureBaseline();
        this.cdr.markForCheck();
      });
    this.baseline = this.snapshot();
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
        this.captureBaseline();
        this.cdr.markForCheck();
      });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['product'] && !changes['product'].firstChange) {
      this.facade.setProduct(this.product);
      this.baseline = this.snapshot();
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
      // El facade ya actualiza el tipo del panel (handleTypeChange).
      if (!this.product) {
        this.openCostBlocks(['Impresión', 'Mano de obra', 'Insumos']);
      }
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
    if (hours > 0) {
      const hoursLabel = new Intl.NumberFormat('es-AR', {
        maximumFractionDigits: 2,
      }).format(hours);
      parts.push(`${hoursLabel} h`);
    }
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

  get showFdm3mfImport(): boolean {
    return this.productType === ProductType.FDM && !this.facade.includesPieces;
  }

  get show3mfFooterHint(): boolean {
    if (!this.showFdm3mfImport) return false;
    if (this.sessionHas3mf || this.existing3mfAttachment) return true;
    const attachments = this.facade.form.controls.attachments.value ?? [];
    return attachments.some((item) => /\.3mf$/i.test(item.name || ''));
  }

  /** Primer adjunto .3mf del producto (edición). */
  get existing3mfAttachment(): ProductAttachment | null {
    const attachments = this.facade.form.controls.attachments.value ?? [];
    return (
      attachments.find((item) => /\.3mf$/i.test(item.name || '')) ?? null
    );
  }

  get saved3mfColorCount(): number {
    const lines = this.facade.form.controls.filamentLines.value ?? [];
    return lines.filter((row) => (Number(row.grams) || 0) > 0 || !!row.colorId)
      .length;
  }

  on3mfApplied(payload: ProductForm3mfApplyPayload): void {
    this.applying3mf = true;
    apply3mfResultToProductForm(this.facade.form, {
      filaments: payload.filaments,
      printTimeHours: payload.printTimeHours,
      purgeGrams: payload.purgeGrams,
      colorChanges: payload.colorChanges,
    });

    this.sourcedFrom3mf = {
      filaments: payload.result.sliced,
      printHours: payload.result.printHours != null,
      purge: payload.purgeGrams != null && payload.purgeGrams > 0,
    };
    this.sessionHas3mf = true;
    this.applying3mf = false;

    this.mediaSection?.addAttachmentFiles([payload.file]);
    this.userEdited = true;
    this.cdr.markForCheck();
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
    this.openBlocksForMissing();
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
