import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { catchError, map, of, switchMap } from 'rxjs';
import {
  Category,
  ColorConfig,
  CostBreakdown,
  FilamentType,
  GeneralSettings,
  Product,
  Product3D,
  ProductAttachment,
  ProductStockOverview,
  ResinType,
  ServiceProfitMargins,
  WholesaleDiscountSettings,
  isProduct3D,
} from '../../../core/models';
import { RealtimeEvent } from '../../../core/models/realtime.model';
import { CategoryCatalogService } from '../../../core/services/category-catalog.service';
import { MediaUploadService } from '../../../core/services/media-upload.service';
import { ProductCatalogService } from '../../../core/services/product-catalog.service';
import { ProductCostCalculationService } from '../../../core/services/product-cost-calculation.service';
import { ProductsService } from '../../../core/services/products.service';
import { RealtimeCatalogSyncService } from '../../../core/services/realtime-catalog-sync.service';
import { RealtimeService } from '../../../core/services/realtime.service';
import { SaleCartService } from '../../../core/services/sale-cart.service';
import { SettingsService } from '../../../core/services/settings.service';
import { productStockOverview } from '../../../shared/utils/stock.helpers';
import { ProductDetailProductionComponent } from './product-detail-production/product-detail-production.component';
import {
  DbAttachmentUploadComponent,
  DbAttachmentUploadFn,
  DbButtonComponent,
  DbSkeletonComponent,
  DbStateMessageComponent,
  MobileBarComponent,
  MobileCollapsibleComponent,
  MobileDockComponent,
  MobileSheetComponent,
  ProductBadgesComponent,
  ProductComponentsTableComponent,
  ProductImageCarouselComponent,
  ProductPricingComponent,
  type MobileDockAction,
} from '@general-components';
import { normalizeProductAttachments } from '../../../shared/utils/product-attachment.helpers';
import { FormDialogService } from '../../../modals/public-api';
import { extractApiErrorMessage } from '../../../shared/utils/api-error';
import { resolveColorLabel } from '../../../shared/utils/color.helpers';
import { markupPercentOnCostRounded } from '../../../shared/utils/product-margin.util';
import {
  isProductPublished,
  normalizeProductComponents,
  resolveCategoryNames,
  resolveProductGrams,
  resolveProductPrintTimeHours,
  resolveProductWorkTimeHours,
} from '../../../shared/utils/product.helpers';
import {
  DEFAULT_PROFIT_MARGINS,
  getMarginForProductType,
  normalizeProfitMargins,
} from '../../../shared/utils/pricing.util';
import {
  DEFAULT_WHOLESALE_DISCOUNT,
  normalizeWholesaleDiscount,
  wholesalePriceFromList,
} from '../../../shared/utils/wholesale-example.util';
import {
  CurrencyArsPipe,
  DateShortPipe,
  ProductTypeLabelPipe,
} from '../../../shared/pipes/labels.pipe';
import {
  FILAMENT_TYPE_LABELS,
  PRODUCT_TYPE_LABELS,
  RESIN_TYPE_LABELS,
} from '../../../shared/constants/labels';
import { resolveFilamentPricePerKg, resolveResinPricePerLiter } from '../../../shared/utils/material-type-price.util';
import { formatCurrencyArs } from '../../../shared/utils/currency-ars.util';
import { resolveFdmFilaments } from '../../../shared/utils/fdm.helpers';

export interface MobileCostCompositionRow {
  title: string;
  detail: string | null;
  amount: number | null;
}

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    CurrencyArsPipe,
    DateShortPipe,
    ProductTypeLabelPipe,
    DbButtonComponent,
    DbAttachmentUploadComponent,
    DbSkeletonComponent,
    DbStateMessageComponent,
    MobileBarComponent,
    MobileCollapsibleComponent,
    MobileDockComponent,
    MobileSheetComponent,
    ProductBadgesComponent,
    ProductImageCarouselComponent,
    ProductPricingComponent,
    ProductComponentsTableComponent,
    ProductDetailProductionComponent,
  ],
  templateUrl: './product-detail.component.html',
  styleUrl: './product-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductDetailComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly productsService = inject(ProductsService);
  private readonly catalogService = inject(ProductCatalogService);
  private readonly categoryCatalog = inject(CategoryCatalogService);
  private readonly catalogSync = inject(RealtimeCatalogSyncService);
  private readonly realtime = inject(RealtimeService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly formDialogs = inject(FormDialogService);
  private readonly mediaUpload = inject(MediaUploadService);
  private readonly settingsService = inject(SettingsService);
  private readonly costCalculation = inject(ProductCostCalculationService);
  private readonly saleCart = inject(SaleCartService);
  product: Product | null = null;
  colorCatalog: ColorConfig[] = [];
  generalSettings: GeneralSettings | null = null;
  profitMargins: ServiceProfitMargins = { ...DEFAULT_PROFIT_MARGINS };
  wholesaleDiscount: WholesaleDiscountSettings = {
    ...DEFAULT_WHOLESALE_DISCOUNT,
  };
  attachments: ProductAttachment[] = [];
  categories: Category[] = [];
  catalogProducts: Product[] = [];
  stock: ProductStockOverview | null = null;
  loading = true;
  notFound = false;

  publishLoading = false;
  attachmentsSaving = false;
  attachmentsError = '';
  mobileActionsOpen = false;
  cartNotice = '';

  readonly uploadProductAttachment: DbAttachmentUploadFn = (file) =>
    firstValueFrom(this.mediaUpload.uploadProductAttachment(file));

  get product3d(): Product3D | null {
    return this.product && isProduct3D(this.product) ? this.product : null;
  }

  get stockOverview(): ProductStockOverview {
    return productStockOverview(this.product ?? { stock: 0 }, this.stock);
  }

  ngOnInit(): void {
    this.settingsService
      .getGeneralSettings()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
      next: (settings) => {
        this.generalSettings = settings;
        this.colorCatalog = settings.colors ?? [];
        this.profitMargins = normalizeProfitMargins(settings.profitMargins);
        this.wholesaleDiscount = normalizeWholesaleDiscount(
          settings.wholesaleDiscount,
        );
        this.cdr.markForCheck();
      },
    });

    this.route.paramMap
      .pipe(
        map((params) => params.get('id')),
        switchMap((id) => this.loadProduct(id)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        if (!result) return;
        this.product = result.product;
        this.attachments = normalizeProductAttachments(result.product.attachments);
        this.categories = result.categories;
        this.catalogProducts = result.catalog;
        this.stock = result.stock;
        this.loading = false;
        this.cdr.markForCheck();
      });

    this.realtime.bindSmartReload(
      this.destroyRef,
      'products',
      (event) => this.handleRealtime(event),
      {
        skip: () => this.publishLoading || this.attachmentsSaving,
      },
    );
  }

  get categoryNames(): string[] {
    if (!this.product) return [];
    return resolveCategoryNames(this.product.categoryIds, this.categories);
  }

  get resolvedComponents() {
    return normalizeProductComponents(
      this.product?.components ?? [],
      this.catalogProducts,
    );
  }

  get hasComponents(): boolean {
    return this.resolvedComponents.length > 0;
  }

  get displayCost(): number {
    return this.product?.cost ?? 0;
  }

  get displayPrice(): number {
    return this.product?.price ?? 0;
  }

  get displayProfit(): number {
    if (!this.product) return 0;
    return this.product.profit ?? this.displayPrice - this.displayCost;
  }

  /** Margen objetivo del área del producto (impresión 3D / estampado). */
  get targetMarginPercent(): number {
    if (!this.product) return 0;
    return getMarginForProductType(this.product.type, this.profitMargins);
  }

  get isPublished(): boolean {
    return this.product ? isProductPublished(this.product) : false;
  }

  get publishActionLabel(): string {
    return this.isPublished ? 'Despublicar' : 'Publicar';
  }

  get grams(): number {
    if (!this.product3d) return 0;
    return resolveProductGrams(this.product3d, this.catalogProducts);
  }

  get printHours(): number {
    if (!this.product3d) return 0;
    return resolveProductPrintTimeHours(this.product3d, this.catalogProducts);
  }

  get workHours(): number {
    if (!this.product3d) return 0;
    return resolveProductWorkTimeHours(this.product3d, this.catalogProducts);
  }

  get wholesalePrice(): number | null {
    const percent = this.wholesaleDiscount.percent;
    if (!(percent > 0) || !(this.displayPrice > 0)) return null;
    return wholesalePriceFromList(this.displayPrice, percent);
  }

  get mobileMetaLine(): string {
    if (!this.product) return '';
    const parts: string[] = [];
    if (this.categoryNames.length) {
      parts.push(this.categoryNames.join(', '));
    }
    if (this.product.size?.trim()) {
      parts.push(this.product.size.trim());
    }
    const updated = formatUpdatedRelative(this.product.updatedAt);
    if (updated) parts.push(updated);
    return parts.join(' · ');
  }

  get mobileMarginLine(): string {
    const margin = markupPercentOnCostRounded(
      this.displayPrice,
      this.displayCost,
    );
    const target = this.targetMarginPercent;
    const nbsp = '\u00a0';
    const marginPart =
      margin == null ? 'Sin margen' : `Margen ${margin}${nbsp}%`;
    return `${marginPart} · objetivo ${target}${nbsp}%`;
  }

  /** Filas de composición mobile con montos del mismo cálculo de costo de la app. */
  get mobileCostCompositionRows(): MobileCostCompositionRow[] {
    const printed = this.product3d;
    const settings = this.generalSettings;
    if (!printed || !settings) return [];

    const breakdown = this.mobileCostBreakdown;
    const rows: MobileCostCompositionRow[] = [];

    if (!this.hasComponents) {
      const filaments = resolveFdmFilaments(printed);
      if (filaments.length) {
        for (const line of filaments) {
          const grams = Number(line.grams) || 0;
          const pricePerKg = resolveFilamentPricePerKg(
            settings,
            line.filamentType,
          );
          const amount =
            pricePerKg == null
              ? null
              : Math.round((grams / 1000) * pricePerKg);
          rows.push({
            title: `Filamento ${FILAMENT_TYPE_LABELS[line.filamentType as FilamentType] ?? String(line.filamentType).toUpperCase()} · ${grams} g`,
            detail:
              pricePerKg == null
                ? this.colorLabel(line.colorId)
                : `${formatCurrencyArs(pricePerKg)} / kg`,
            amount,
          });
        }
      } else if (this.grams > 0 || printed.filamentType || printed.resinType) {
        if (printed.resinType) {
          const pricePerL = resolveResinPricePerLiter(
            settings,
            printed.resinType,
          );
          const amount =
            pricePerL == null
              ? breakdown?.materialCost ?? null
              : Math.round((this.grams / 1000) * pricePerL);
          rows.push({
            title: `Resina ${RESIN_TYPE_LABELS[printed.resinType as ResinType] ?? printed.resinType} · ${this.grams} g`,
            detail:
              pricePerL == null
                ? printed.brand || null
                : `${formatCurrencyArs(pricePerL)} / L`,
            amount,
          });
        } else {
          const pricePerKg = resolveFilamentPricePerKg(
            settings,
            printed.filamentType,
          );
          const amount =
            pricePerKg == null
              ? breakdown?.materialCost ?? null
              : Math.round((this.grams / 1000) * pricePerKg);
          rows.push({
            title: printed.filamentType
              ? `Filamento ${FILAMENT_TYPE_LABELS[printed.filamentType as FilamentType] ?? String(printed.filamentType).toUpperCase()} · ${this.grams} g`
              : `Material · ${this.grams} g`,
            detail:
              pricePerKg == null
                ? printed.brand || null
                : `${formatCurrencyArs(pricePerKg)} / kg`,
            amount,
          });
        }
      }
    }

    if (this.printHours > 0) {
      const printAmount =
        breakdown != null
          ? Math.round(breakdown.energyCost + breakdown.machineCost)
          : null;
      rows.push({
        title: `Impresión · ${this.printHours} h`,
        detail: PRODUCT_TYPE_LABELS[printed.type] ?? printed.type,
        amount: printAmount,
      });
    }

    if (this.workHours > 0) {
      const rate = Number(settings.laborCostPerHour) || 0;
      rows.push({
        title: `Mano de obra · ${this.workHours} h`,
        detail: rate > 0 ? `${formatCurrencyArs(rate)} / h` : null,
        amount: breakdown?.laborCost ?? (rate > 0 ? Math.round(this.workHours * rate) : null),
      });
    }

    if (printed.washMinutes) {
      rows.push({
        title: `Lavado · ${printed.washMinutes} min`,
        detail: null,
        amount: null,
      });
    }

    if (printed.cureMinutes) {
      rows.push({
        title: `Curado · ${printed.cureMinutes} min`,
        detail: null,
        amount: null,
      });
    }

    if (this.hasComponents) {
      rows.push({
        title: `Piezas incluidas · ${this.resolvedComponents.length}`,
        detail:
          this.product && this.product.assemblyTimeHours > 0
            ? `Armado ${this.product.assemblyTimeHours} h`
            : null,
        amount: breakdown?.materialCost ?? null,
      });
    }

    const errorPercent = Number(settings.errorMarginPercent) || 0;
    if (errorPercent > 0 || (breakdown?.errorMarginCost ?? 0) > 0) {
      rows.push({
        title: `Margen de error · ${errorPercent} %`,
        detail: 'Sobre material y máquina',
        amount: breakdown?.errorMarginCost ?? null,
      });
    }

    return rows;
  }

  private get mobileCostBreakdown(): CostBreakdown | null {
    const printed = this.product3d;
    const settings = this.generalSettings;
    // Combo/piezas: sin recalcular costos de componentes acá.
    if (!printed || !settings || this.hasComponents) return null;
    return this.costCalculation.calculateCost(
      {
        type: printed.type,
        grams: this.grams,
        printTimeHours: this.printHours,
        workTimeHours: this.workHours,
        brand: printed.brand,
        filamentType: printed.filamentType,
        filaments: printed.filaments,
        resinType: printed.resinType,
        washMinutes: printed.washMinutes,
        cureMinutes: printed.cureMinutes,
      },
      { settings },
    );
  }

  colorLabel(colorId?: string): string {
    return resolveColorLabel(colorId, this.colorCatalog);
  }

  ngOnDestroy(): void {
    this.closeMobileActions();
  }

  openMobileActions(): void {
    if (this.mobileActionsOpen) return;
    this.mobileActionsOpen = true;
    this.cdr.markForCheck();
  }

  closeMobileActions(): void {
    if (!this.mobileActionsOpen) return;
    this.mobileActionsOpen = false;
    this.cdr.markForCheck();
  }

  readonly mobileDockActions: MobileDockAction[] = [
    { id: 'sell', label: 'Vender', kind: 'primary' },
  ];

  onMobileDockAction(id: string): void {
    if (id === 'sell') {
      this.sellProduct();
    }
  }

  sellProduct(): void {
    if (!this.product) return;
    const result = this.saleCart.addProduct(this.product, 1);
    this.cartNotice = result.ok
      ? `${this.product.name} quedó en el carrito de ventas.`
      : (result.error ?? 'No se pudo agregar al carrito');
    this.cdr.markForCheck();
    if (result.ok) {
      void this.router.navigateByUrl('/ventas/nueva');
    }
  }

  openEdit(): void {
    if (!this.product) return;

    this.productsService.getProduct(this.product.id).subscribe({
      next: (fresh) => {
        this.formDialogs.openProduct(fresh).subscribe((updated) => {
          if (!updated) return;
          this.reloadCurrentProduct();
        });
      },
      error: (err) => {
        this.formDialogs
          .openConfirm({
            title: 'No se pudo cargar',
            message: extractApiErrorMessage(err, 'No se pudo cargar el producto'),
            confirmLabel: 'Entendido',
            alertOnly: true,
          })
          .subscribe();
      },
    });
  }

  deleteProduct(): void {
    if (!this.product) return;
    const product = this.product;
    this.formDialogs
      .openConfirm({
        title: 'Eliminar producto',
        message: `¿Eliminar "${product.name}"?`,
        confirmLabel: 'Eliminar',
        confirmVariant: 'delete',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.productsService.deleteProduct(product.id).subscribe({
          next: () => {
            this.catalogService.loadProducts({ all: true, refresh: true });
            void this.router.navigate(['/productos']);
          },
          error: (err) => {
            this.formDialogs
              .openConfirm({
                title: 'No se pudo eliminar',
                message: extractApiErrorMessage(err, 'No se pudo eliminar el producto'),
                confirmLabel: 'Entendido',
                alertOnly: true,
              })
              .subscribe();
          },
        });
      });
  }

  togglePublished(): void {
    if (!this.product || this.publishLoading) return;

    const nextPublished = !this.isPublished;
    const action = nextPublished ? 'publicar' : 'despublicar';
    const previous = this.product;
    this.formDialogs
      .openConfirm({
        title: nextPublished ? 'Publicar producto' : 'Despublicar producto',
        message: `¿${action.charAt(0).toUpperCase()}${action.slice(1)} "${previous.name}" en el catálogo?`,
        confirmLabel: nextPublished ? 'Publicar' : 'Despublicar',
      })
      .subscribe((confirmed) => {
        if (confirmed) this.applyPublished(previous, nextPublished);
      });
  }

  private applyPublished(previous: Product, nextPublished: boolean): void {
    this.product = { ...previous, published: nextPublished };
    this.publishLoading = true;
    this.cdr.markForCheck();

    this.productsService
      .updateProduct(previous.id, { published: nextPublished })
      .subscribe({
        next: (updated) => {
          this.publishLoading = false;
          this.product = updated;
          this.catalogService.loadProducts({ all: true, refresh: true });
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.publishLoading = false;
          this.product = previous;
          this.cdr.markForCheck();
          this.formDialogs
            .openConfirm({
              title: 'No se pudo actualizar',
              message: extractApiErrorMessage(err, 'No se pudo actualizar el producto'),
              confirmLabel: 'Entendido',
              alertOnly: true,
            })
            .subscribe();
        },
      });
  }

  private handleRealtime(event: RealtimeEvent): void {
    this.catalogSync.handleEvent(event);
    this.reloadCurrentProduct();
  }

  private reloadCurrentProduct(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;

    this.loadProduct(id).subscribe((result) => {
      if (!result) return;
      this.product = result.product;
      this.attachments = normalizeProductAttachments(result.product.attachments);
      this.categories = result.categories;
      this.catalogProducts = result.catalog;
      this.stock = result.stock;
      this.loading = false;
      this.cdr.markForCheck();
    });
  }

  onAttachmentsChange(next: ProductAttachment[]): void {
    if (!this.product || this.attachmentsSaving) return;

    const previous = this.product;
    const previousAttachments = this.attachments;
    this.attachments = next;
    this.attachmentsSaving = true;
    this.attachmentsError = '';
    this.product = { ...this.product, attachments: next };
    this.cdr.markForCheck();

    this.productsService
      .updateProduct(previous.id, { attachments: next })
      .subscribe({
        next: (updated) => {
          this.attachmentsSaving = false;
          this.product = updated;
          this.attachments = normalizeProductAttachments(updated.attachments);
          this.catalogService.loadProducts({ all: true, refresh: true });
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.attachmentsSaving = false;
          this.product = previous;
          this.attachments = previousAttachments;
          this.attachmentsError = extractApiErrorMessage(
            err,
            'No se pudieron guardar los archivos adjuntos',
          );
          this.cdr.markForCheck();
        },
      });
  }

  private loadProduct(id: string | null) {
    if (!id) {
      this.notFound = true;
      this.loading = false;
      return of(null);
    }

    this.loading = true;
    this.notFound = false;
    this.cdr.markForCheck();

    return this.productsService.getProductOverview(id).pipe(
      map(({ product, categories, catalogProducts, stock }) => ({
        product,
        categories,
        catalog: catalogProducts,
        stock,
      })),
      catchError((err) => {
        this.loading = false;
        this.notFound = err.status === 404;
        this.cdr.markForCheck();
        return of(null);
      }),
    );
  }
}

function formatUpdatedRelative(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0) return 'actualizado recién';
  const days = Math.floor(diffMs / 86_400_000);
  if (days <= 0) return 'actualizado hoy';
  if (days === 1) return 'actualizado hace 1 día';
  if (days < 30) return `actualizado hace ${days} días`;
  const months = Math.floor(days / 30);
  if (months === 1) return 'actualizado hace 1 mes';
  return `actualizado hace ${months} meses`;
}
