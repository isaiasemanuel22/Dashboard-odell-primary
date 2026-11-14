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
import { EMPTY, catchError, map, of, startWith, switchMap } from 'rxjs';
import {
  Category,
  ColorConfig,
  CostBreakdown,
  FilamentType,
  GeneralSettings,
  Product,
  Product3D,
  ProductAttachment,
  EstampadoSupplyLine,
  ProductEstampado,
  ProductType,
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
import { formatDecimalEs } from '../../../shared/utils/decimal-es.util';
import { productStockOverview } from '../../../shared/utils/stock.helpers';
import { ProductDetailEstampadoComponent } from './product-detail-estampado/product-detail-estampado.component';
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
  DecimalEsPipe,
  ProductTypeLabelPipe,
} from '../../../shared/pipes/labels.pipe';
import {
  FILAMENT_TYPE_LABELS,
  PRODUCT_TYPE_LABELS,
  RESIN_TYPE_LABELS,
} from '../../../shared/constants/labels';
import { Store } from '@ngrx/store';
import { selectSupplies } from '../../../store/supplies/supplies.selectors';
import { selectImpresos } from '../../../store/impresos/impresos.selectors';
import { SuppliesFacade } from '../../../store/supplies/supplies.facade';
import { ImpresosService } from '../../../core/services/impresos.service';
import { calcWashSupplyCost } from '../../../shared/utils/machine-profile.util';
import { formatSupplyQuantity } from '../../../shared/utils/supply-unit.util';
import {
  normalizeEstampadoPrints,
  normalizeEstampadoSupplies,
  printQuantity,
  resolvePrintDimensions,
  totalEstampadoPressMinutes,
} from '../../../shared/utils/estampado.helpers';
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
    DecimalEsPipe,
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
    ProductDetailEstampadoComponent,
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
  private readonly ngrxStore = inject(Store);
  private readonly suppliesSignal = this.ngrxStore.selectSignal(selectSupplies);
  private readonly impresosSignal = this.ngrxStore.selectSignal(selectImpresos);
  private readonly suppliesFacade = inject(SuppliesFacade);
  private readonly impresosService = inject(ImpresosService);
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

  get productEstampado(): ProductEstampado | null {
    return this.product?.type === ProductType.ESTAMPADO
      ? (this.product as ProductEstampado)
      : null;
  }

  get stockOverview(): ProductStockOverview {
    return productStockOverview(this.product ?? { stock: 0 }, this.stock);
  }

  ngOnInit(): void {
    this.suppliesFacade.load(false);
    this.impresosService
      .getImpresos()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.cdr.markForCheck());
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
    const margin = this.marginPercent;
    const target = this.targetMarginPercent;
    const nbsp = '\u00a0';
    const marginPart =
      margin == null ? 'Sin margen' : `Margen ${margin}${nbsp}%`;
    return `${marginPart} · objetivo ${target}${nbsp}%`;
  }

  /** Mano de obra del producto (armado si es compuesto): no lleva margen. */
  get laborCost(): number {
    const settings = this.generalSettings;
    const product = this.product;
    if (!settings || !product) return 0;
    const rate = Number(settings.laborCostPerHour) || 0;
    if (rate <= 0) return 0;
    let hours = 0;
    if (this.hasComponents) {
      hours = Number(product.assemblyTimeHours) || 0;
    } else if (this.product3d) {
      hours = this.workHours;
    } else if (this.productEstampado) {
      hours = Number(this.productEstampado.workTimeHours) || 0;
    }
    return Math.round(hours * rate);
  }

  /** Margen sobre el costo sin mano de obra (null si no hay base). */
  get marginPercent(): number | null {
    return markupPercentOnCostRounded(
      this.displayPrice,
      this.displayCost,
      this.laborCost,
    );
  }

  /** Avisos de precio por debajo del costo (lista y mayorista). */
  get priceWarnings(): string[] {
    const cost = this.displayCost;
    const price = this.displayPrice;
    const warnings: string[] = [];
    if (!(cost > 0) || !(price > 0)) return warnings;
    const nbsp = '\u00a0';
    if (price < cost) {
      const margin = this.marginPercent;
      warnings.push(
        `Precio de lista por debajo del costo (${formatCurrencyArs(price)} < ${formatCurrencyArs(cost)})${margin == null ? '' : `: margen ${margin}${nbsp}%`}. Se vende a pérdida.`,
      );
    }
    const wholesale = this.wholesalePrice;
    if (wholesale != null && wholesale < cost) {
      warnings.push(
        `Precio mayorista por debajo del costo (${formatCurrencyArs(wholesale)} < ${formatCurrencyArs(cost)}). Vender por mayor genera pérdida.`,
      );
    }
    return warnings;
  }

  /**
   * Composición del costo (todos los tipos). Los bloques suman exactamente
   * el costo del producto: insumos aparte y, si queda diferencia, "Otros costos".
   */
  get costCompositionRows(): MobileCostCompositionRow[] {
    const product = this.product;
    const settings = this.generalSettings;
    if (!product || !settings) return [];

    let rows: MobileCostCompositionRow[] = [];
    if (this.hasComponents) {
      rows = this.componentCostRows(settings);
    } else if (this.product3d) {
      rows = this.printedCostRows(this.product3d, settings);
    } else if (this.productEstampado) {
      rows = this.estampadoCostRows(this.productEstampado, settings);
    }
    rows = [...rows, ...this.supplyCostRows()];
    return this.reconcileCostRows(rows);
  }

  private reconcileCostRows(
    rows: MobileCostCompositionRow[],
  ): MobileCostCompositionRow[] {
    if (!rows.length) return rows;
    const total = Math.round(this.displayCost);
    if (!(total > 0)) return rows;
    const withAmount = rows.filter((row) => row.amount != null);
    const sum = withAmount.reduce((acc, row) => acc + (row.amount ?? 0), 0);
    const diff = total - sum;
    if (diff === 0) return rows;
    // Ruido de redondeo por línea: se absorbe en el bloque más grande.
    if (withAmount.length && Math.abs(diff) <= withAmount.length) {
      const biggest = withAmount.reduce((a, b) =>
        (b.amount ?? 0) > (a.amount ?? 0) ? b : a,
      );
      return rows.map((row) =>
        row === biggest ? { ...row, amount: (row.amount ?? 0) + diff } : row,
      );
    }
    return [
      ...rows,
      {
        title: 'Otros costos',
        detail: 'Diferencia con el costo guardado del producto',
        amount: diff,
      },
    ];
  }

  private componentCostRows(settings: GeneralSettings): MobileCostCompositionRow[] {
    const rows: MobileCostCompositionRow[] = this.resolvedComponents.map(
      (item) => {
        const part = this.catalogProducts.find((p) => p.id === item.productId);
        const quantity = Math.max(1, Number(item.quantity) || 1);
        return {
          title: `${part?.name ?? 'Pieza'} × ${quantity}`,
          detail: part ? `${formatCurrencyArs(part.cost)} c/u` : null,
          amount: part ? Math.round((Number(part.cost) || 0) * quantity) : null,
        };
      },
    );
    const assemblyHours = Number(this.product?.assemblyTimeHours) || 0;
    if (assemblyHours > 0) {
      const rate = Number(settings.laborCostPerHour) || 0;
      rows.push({
        title: `Armado · ${formatDecimalEs(assemblyHours)} h`,
        detail: rate > 0 ? `${formatCurrencyArs(rate)} / h · sin margen` : null,
        amount: rate > 0 ? this.laborCost : null,
      });
    }
    return rows;
  }

  private supplyCostRows(): MobileCostCompositionRow[] {
    const lines = normalizeEstampadoSupplies(
      (this.product as { supplies?: EstampadoSupplyLine[] } | null)?.supplies,
    );
    const catalog = this.suppliesSignal();
    return lines.map((line) => {
      const supply = catalog.find((item) => item.id === line.supplyId);
      const unitPrice = Number(supply?.unitPrice) || 0;
      return {
        title: `Insumo · ${supply?.name ?? 'Insumo'}`,
        detail: supply
          ? formatSupplyQuantity(line.quantity, supply.unit)
          : String(line.quantity),
        amount: unitPrice > 0 ? Math.round(unitPrice * line.quantity) : null,
      };
    });
  }

  private estampadoCostRows(
    product: ProductEstampado,
    settings: GeneralSettings,
  ): MobileCostCompositionRow[] {
    const impresos = this.impresosSignal();
    const getImpreso = (id: string) => impresos.find((item) => item.id === id);
    const rows: MobileCostCompositionRow[] = [];

    for (const print of normalizeEstampadoPrints(product.prints)) {
      const impreso = print.impresoId ? getImpreso(print.impresoId) : undefined;
      const dims = resolvePrintDimensions(print, getImpreso);
      const quantity = printQuantity(print);
      rows.push({
        title: `Impreso · ${impreso?.name ?? print.label?.trim() ?? 'Impreso'} × ${quantity}`,
        detail: null,
        amount: dims
          ? Math.round(
              this.costCalculation.calculateImpresoPaperCost(
                settings,
                dims.paperType,
                dims.widthCm,
                dims.heightCm,
              ) * quantity,
            )
          : null,
      });
    }

    const breakdown = this.costCalculation.calculateCost(
      {
        type: ProductType.ESTAMPADO,
        workTimeHours: Number(product.workTimeHours) || 0,
        estampadoPrints: product.prints,
        estampadoPressCycles: product.pressCycles,
      },
      { settings, impresos },
    );

    const pressMinutes = totalEstampadoPressMinutes(product.pressCycles);
    if (pressMinutes > 0) {
      rows.push({
        title: `Plancha · ${formatDecimalEs(pressMinutes)} min`,
        detail: 'Luz y máquina',
        amount: Math.round(breakdown.energyCost + breakdown.machineCost),
      });
    }
    this.pushLaborRow(rows, Number(product.workTimeHours) || 0, settings);
    this.pushErrorMarginRow(rows, breakdown, settings);
    return rows;
  }

  private pushLaborRow(
    rows: MobileCostCompositionRow[],
    hours: number,
    settings: GeneralSettings,
  ): void {
    if (!(hours > 0)) return;
    const rate = Number(settings.laborCostPerHour) || 0;
    rows.push({
      title: `Mano de obra · ${formatDecimalEs(hours)} h`,
      detail: rate > 0 ? `${formatCurrencyArs(rate)} / h · sin margen` : null,
      amount: rate > 0 ? Math.round(hours * rate) : null,
    });
  }

  private pushErrorMarginRow(
    rows: MobileCostCompositionRow[],
    breakdown: CostBreakdown | null,
    settings: GeneralSettings,
  ): void {
    const errorPercent = Number(settings.errorMarginPercent) || 0;
    if (!breakdown || (errorPercent <= 0 && breakdown.errorMarginCost <= 0)) {
      return;
    }
    rows.push({
      title: `Margen de error · ${formatDecimalEs(errorPercent)} %`,
      detail:
        (breakdown.purgeCost ?? 0) > 0
          ? 'Solo sobre material, purga, luz y máquina (sin insumos)'
          : 'Solo sobre material, luz y máquina (sin insumos)',
      amount: breakdown.errorMarginCost,
    });
  }

  private printedCostRows(
    printed: Product3D,
    settings: GeneralSettings,
  ): MobileCostCompositionRow[] {
    const breakdown = this.printedCostBreakdown(printed, settings);
    const rows: MobileCostCompositionRow[] = [];

    const filaments = resolveFdmFilaments(printed);
    if (filaments.length) {
      for (const line of filaments) {
        const grams = Number(line.grams) || 0;
        const pricePerKg = resolveFilamentPricePerKg(
          settings,
          line.filamentType,
          this.suppliesSignal(),
        );
        rows.push({
          title: `Filamento ${FILAMENT_TYPE_LABELS[line.filamentType as FilamentType] ?? String(line.filamentType).toUpperCase()} · ${formatDecimalEs(grams)} g`,
          detail:
            pricePerKg == null
              ? this.colorLabel(line.colorId)
              : `${formatCurrencyArs(pricePerKg)} / kg`,
          amount:
            pricePerKg == null ? null : Math.round((grams / 1000) * pricePerKg),
        });
      }
    } else if (this.grams > 0 || printed.filamentType || printed.resinType) {
      if (printed.resinType) {
        const pricePerL = resolveResinPricePerLiter(
          settings,
          printed.resinType,
          this.suppliesSignal(),
          printed.brand,
        );
        rows.push({
          title: `Resina ${RESIN_TYPE_LABELS[printed.resinType as ResinType] ?? printed.resinType} · ${formatDecimalEs(this.grams)} ml`,
          detail:
            pricePerL == null
              ? printed.brand || null
              : `${formatCurrencyArs(pricePerL)} / L`,
          amount:
            pricePerL == null
              ? null
              : Math.round((this.grams / 1000) * pricePerL),
        });
      } else {
        const pricePerKg = resolveFilamentPricePerKg(
          settings,
          printed.filamentType,
          this.suppliesSignal(),
        );
        rows.push({
          title: printed.filamentType
            ? `Filamento ${FILAMENT_TYPE_LABELS[printed.filamentType as FilamentType] ?? String(printed.filamentType).toUpperCase()} · ${formatDecimalEs(this.grams)} g`
            : `Material · ${formatDecimalEs(this.grams)} g`,
          detail:
            pricePerKg == null
              ? printed.brand || null
              : `${formatCurrencyArs(pricePerKg)} / kg`,
          amount:
            pricePerKg == null
              ? null
              : Math.round((this.grams / 1000) * pricePerKg),
        });
      }
    }

    const purgeGrams = Math.max(0, Number(printed.purgeGrams) || 0);
    if (purgeGrams > 0) {
      rows.push({
        title: `Purga AMS · ${formatDecimalEs(purgeGrams)} g`,
        detail:
          printed.colorChanges != null
            ? `${printed.colorChanges} cambios de color`
            : null,
        amount: breakdown?.purgeCost ?? null,
      });
    }

    if (this.printHours > 0) {
      rows.push({
        title: `Impresión · ${formatDecimalEs(this.printHours)} h`,
        detail: PRODUCT_TYPE_LABELS[printed.type] ?? printed.type,
        amount: Math.round(
          (breakdown?.energyCost ?? 0) + (breakdown?.machineCost ?? 0),
        ),
      });
    }

    if (printed.washMinutes) {
      rows.push({
        title: `Lavado · ${printed.washMinutes} min`,
        detail: 'Incluido en luz y máquina',
        amount: null,
      });
    }
    if (printed.cureMinutes) {
      rows.push({
        title: `Curado · ${printed.cureMinutes} min`,
        detail: 'Incluido en luz y máquina',
        amount: null,
      });
    }

    this.pushLaborRow(rows, this.workHours, settings);
    this.pushErrorMarginRow(rows, breakdown, settings);

    if (printed.type === ProductType.RESINA) {
      const washSupplyCost = Math.round(
        calcWashSupplyCost(settings, this.suppliesSignal(), ProductType.RESINA),
      );
      if (washSupplyCost > 0) {
        rows.push({
          title: 'Insumo · Alcohol de lavado',
          detail: 'Sin margen de error',
          amount: washSupplyCost,
        });
      }
    }
    return rows;
  }

  private printedCostBreakdown(
    printed: Product3D,
    settings: GeneralSettings,
  ): CostBreakdown {
    return this.costCalculation.calculateCost(
      {
        type: printed.type,
        grams: this.grams,
        purgeGrams: printed.purgeGrams,
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

    // Primer pintado con solo el producto (GET /products/:id); el resto
    // (categorías, catálogo completo y stock) llega después con /overview.
    return this.productsService.getProduct(id).pipe(
      switchMap((product) => {
        const partial = {
          product,
          categories: this.categories,
          catalog: this.catalogProducts,
          stock: this.stock,
        };
        return this.productsService.getProductOverview(id).pipe(
          map(({ product: full, categories, catalogProducts, stock }) => ({
            product: full,
            categories,
            catalog: catalogProducts,
            stock,
          })),
          catchError(() => of(null)),
          switchMap((full) => (full ? of(full) : EMPTY)),
          startWith(partial),
        );
      }),
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
