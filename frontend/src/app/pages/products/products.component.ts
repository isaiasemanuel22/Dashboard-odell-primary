import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { combineLatest } from 'rxjs';
import {
  Category,
  Product,
  ProductMarginAlert,
  ProductType,
  ServiceProfitMargins,
  SupplyPriceChangeRow,
  WholesaleDiscountSettings,
} from '../../core/models';
import { RealtimeEvent } from '../../core/models/realtime.model';
import { BreakpointService } from '../../core/services/breakpoint.service';
import {
  MOBILE_LIST_KEYS,
  injectMobileListPersistence,
} from '../../core/services/mobile-list-state.service';
import { CategoryCatalogService } from '../../core/services/category-catalog.service';
import { ProductsService } from '../../core/services/products.service';
import { RealtimeCatalogSyncService } from '../../core/services/realtime-catalog-sync.service';
import { RealtimeService } from '../../core/services/realtime.service';
import { SaleCartService } from '../../core/services/sale-cart.service';
import { SuppliesService } from '../../core/services/supplies.service';
import { CatalogFacade } from '../../store/catalog/catalog.facade';
import { SettingsFacade } from '../../store/settings/settings.facade';
import {
  DbSkeletonComponent,
  DbStateMessageComponent,
  DbButtonComponent,
  DbPillOption,
  ProductCardComponent,
  MobileBarComponent,
  MobileBannerComponent,
  MobileListToolbarComponent,
  type MobileListToolbarChip,
  MobileSheetComponent,
} from '@general-components';
import { ProductMobileCardComponent } from '../../components/product-mobile-card/product-mobile-card.component';
import { extractApiErrorMessage } from '../../shared/utils/api-error';
import {
  clearCreateQuery,
  shouldOpenCreateFromQuery,
} from '../../shared/utils/create-from-query.util';
import { hasFixedCatalogPrice } from '../../shared/utils/product-margin.util';
import {
  DEFAULT_PROFIT_MARGINS,
  normalizeProfitMargins,
} from '../../shared/utils/pricing.util';
import { resolveCategoryNamesText } from '../../shared/utils/product.helpers';
import { productListStock } from '../../shared/utils/stock.helpers';
import { normalizeWholesaleDiscount } from '../../shared/utils/wholesale-example.util';
import { countProductMobileSheetFilters } from '../../modals/product-filters-sheet.component';
import { FormDialogService } from '../../modals/public-api';
import { CurrencyArsPipe } from '../../shared/pipes/labels.pipe';
import { LayoutUiService } from '../../layout/layout-ui.service';
import { ProductsBulkPriceComponent } from './products-bulk-price/products-bulk-price.component';
import { ProductsSupplyPriceChangesComponent } from './products-supply-price-changes/products-supply-price-changes.component';
import { ProductsToolbarComponent } from './products-toolbar/products-toolbar.component';
import { normalizeSearchText } from '../../shared/utils/search-text.util';
type TypeFilter = ProductType | 'all';
type ListFilter =
  | 'all'
  | 'below_margin'
  | 'fixed_price'
  | 'in_stock'
  | 'internal';

interface ProductsMobileListState {
  listFilter: ListFilter;
  typeFilter: TypeFilter;
  categoryFilter: string;
  search: string;
  scrollY: number;
}

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    DbSkeletonComponent,
    DbStateMessageComponent,
    DbButtonComponent,
    ProductCardComponent,
    ProductMobileCardComponent,
    ProductsToolbarComponent,
    ProductsBulkPriceComponent,
    ProductsSupplyPriceChangesComponent,
    MobileBarComponent,
    MobileBannerComponent,
    MobileListToolbarComponent,
    MobileSheetComponent,
  ],
  templateUrl: './products.component.html',
  styleUrl: './products.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductsComponent implements OnInit, OnDestroy {
  private readonly catalog = inject(CatalogFacade);
  private readonly productsService = inject(ProductsService);
  private readonly suppliesService = inject(SuppliesService);
  private readonly settingsFacade = inject(SettingsFacade);
  private readonly categoryCatalog = inject(CategoryCatalogService);
  private readonly catalogSync = inject(RealtimeCatalogSyncService);
  private readonly realtime = inject(RealtimeService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly formDialogs = inject(FormDialogService);
  private readonly saleCart = inject(SaleCartService);
  private readonly breakpoint = inject(BreakpointService);
  private readonly listPersistence =
    injectMobileListPersistence<ProductsMobileListState>(
      MOBILE_LIST_KEYS.products,
    );
  private readonly layoutUi = inject(LayoutUiService);
  private readonly currency = new CurrencyArsPipe();

  readonly isMobile = this.breakpoint.isMobile;

  products: Product[] = [];
  allProducts: Product[] = [];
  categories: Category[] = [];
  loading = true;
  cartItemCount = 0;
  cartNotice = '';
  search = '';
  typeFilter: TypeFilter = 'all';
  categoryFilter = 'all';
  listFilter: ListFilter = 'all';
  mobileMoreOpen = false;
  mobileBulkOpen = false;
  mobileSupplyChangesOpen = false;

  marginAlerts: ProductMarginAlert[] = [];
  supplyPriceChanges: SupplyPriceChangeRow[] = [];
  supplyChangesLoading = false;
  profitMargins: ServiceProfitMargins = { ...DEFAULT_PROFIT_MARGINS };
  wholesaleDiscount: WholesaleDiscountSettings =
    normalizeWholesaleDiscount(null);

  private belowMarginIds = new Set<string>();

  readonly ProductType = ProductType;
  readonly typeFilters: { value: TypeFilter; label: string }[] = [
    { value: 'all', label: 'Todos' },
    { value: ProductType.FDM, label: 'FDM' },
    { value: ProductType.RESINA, label: 'Resina' },
    { value: ProductType.ESTAMPADO, label: 'Estampado' },
    { value: ProductType.COMBO, label: 'Combo' },
  ];

  ngOnInit(): void {
    this.listPersistence.connect(() => ({
      listFilter: this.listFilter,
      typeFilter: this.typeFilter,
      categoryFilter: this.categoryFilter,
      search: this.search,
    }));

    const queryApplied = this.applyMobileQueryParams();
    if (!queryApplied) {
      this.listPersistence.restore((saved) => {
        this.listFilter = saved.listFilter;
        this.typeFilter = saved.typeFilter;
        this.categoryFilter = saved.categoryFilter;
        this.search = saved.search;
      });
    }

    this.catalog.load();
    this.settingsFacade.load();

    combineLatest([
      this.catalog.products$,
      this.catalog.loading$,
      this.catalog.categories$,
      this.catalog.allProducts$,
    ])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([products, loading, categories, allProducts]) => {
        this.products = products;
        this.loading = loading;
        this.categories = categories;
        this.allProducts = allProducts;
        this.cdr.markForCheck();
        if (!loading) {
          this.listPersistence.onListReady();
        }
      });

    this.settingsFacade
      .watchUntilDestroyed(this.destroyRef)
      .subscribe((settings) => {
        if (!settings) return;
        this.profitMargins = normalizeProfitMargins(settings.profitMargins);
        this.wholesaleDiscount = normalizeWholesaleDiscount(
          settings.wholesaleDiscount,
        );
        this.cdr.markForCheck();
      });

    this.reloadProducts();
    this.reloadMarginAlerts();
    this.reloadSupplyPriceChanges();

    this.saleCart.lines$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((lines) => {
        this.cartItemCount = lines.reduce((sum, line) => sum + line.quantity, 0);
        this.cdr.markForCheck();
      });

    this.realtime.bindSmartReload(this.destroyRef, 'products', (event) =>
      this.handleRealtime(event),
    );

    if (shouldOpenCreateFromQuery(this.route)) {
      this.openCreateProduct();
      clearCreateQuery(this.router);
    }
  }

  ngOnDestroy(): void {
    this.closeAllMobileSheets();
  }

  openMobileMore(): void {
    if (this.mobileMoreOpen) return;
    this.mobileMoreOpen = true;
    this.cdr.markForCheck();
  }

  closeMobileMore(): void {
    if (!this.mobileMoreOpen) return;
    this.mobileMoreOpen = false;
    this.cdr.markForCheck();
  }

  openMobileBulkPrice(): void {
    this.closeMobileMore();
    if (this.mobileBulkOpen) return;
    this.mobileBulkOpen = true;
    this.layoutUi.pushOverlay();
    this.cdr.markForCheck();
  }

  closeMobileBulkPrice(): void {
    if (!this.mobileBulkOpen) return;
    this.mobileBulkOpen = false;
    this.layoutUi.popOverlay();
    this.cdr.markForCheck();
  }

  openMobileSupplyChanges(): void {
    this.closeMobileMore();
    if (this.mobileSupplyChangesOpen) return;
    this.mobileSupplyChangesOpen = true;
    this.layoutUi.pushOverlay();
    this.cdr.markForCheck();
  }

  closeMobileSupplyChanges(): void {
    if (!this.mobileSupplyChangesOpen) return;
    this.mobileSupplyChangesOpen = false;
    this.layoutUi.popOverlay();
    this.cdr.markForCheck();
  }

  private closeAllMobileSheets(): void {
    this.mobileMoreOpen = false;
    if (this.mobileBulkOpen) {
      this.mobileBulkOpen = false;
      this.layoutUi.popOverlay();
    }
    if (this.mobileSupplyChangesOpen) {
      this.mobileSupplyChangesOpen = false;
      this.layoutUi.popOverlay();
    }
  }

  get targetMarginPercent(): number {
    return (
      this.profitMargins.impresion_3d ?? DEFAULT_PROFIT_MARGINS.impresion_3d
    );
  }

  get listFilters(): DbPillOption<ListFilter>[] {
    const below = this.marginAlertCount;
    const fixed = this.fixedPriceCount;
    return [
      { value: 'all', label: 'Todos' },
      {
        value: 'below_margin',
        label: `Bajo margen · ${below}`,
      },
      {
        value: 'fixed_price',
        label: `Precio fijo · ${fixed}`,
      },
      { value: 'in_stock', label: 'Con stock' },
      { value: 'internal', label: `Internos · ${this.internalCount}` },
    ];
  }

  /** Productos internos (no publicados): no salen en «Todos». */
  get internalCount(): number {
    return this.products.filter((p) => p.published === false).length;
  }

  /**
   * Chips mobile: contadores sobre búsqueda + tipo + categoría
   * (lo que se vería al tocar ese chip). Se ocultan los de contador 0,
   * salvo «Todos» y el chip activo.
   */
  get mobileToolbarChips(): MobileListToolbarChip[] {
    const base = this.productsMatchingSearchTypeCategory;
    const chips: MobileListToolbarChip[] = [
      {
        id: 'all',
        label: 'Todos',
        count: base.filter((p) => p.published !== false).length,
      },
      {
        id: 'below_margin',
        label: 'Bajo margen',
        count: base.filter((p) => this.belowMarginIds.has(p.id)).length,
      },
      {
        id: 'fixed_price',
        label: 'Precio fijo',
        count: base.filter((p) => hasFixedCatalogPrice(p)).length,
      },
      {
        id: 'in_stock',
        label: 'Con stock',
        count: base.filter((p) => productListStock(p) > 0).length,
      },
      {
        id: 'internal',
        label: 'Internos',
        count: base.filter((p) => p.published === false).length,
      },
    ];
    return chips.filter(
      (chip) =>
        chip.id === 'all' ||
        (chip.count ?? 0) > 0 ||
        this.listFilter === chip.id,
    );
  }

  get marginAlertCount(): number {
    return this.marginAlerts.length;
  }

  get fixedPriceCount(): number {
    return this.products.filter((product) => hasFixedCatalogPrice(product))
      .length;
  }

  get topSupplyIncrease(): SupplyPriceChangeRow | null {
    const increases = this.supplyPriceChanges.filter(
      (row) => row.variationPercent > 0,
    );
    if (increases.length === 0) return null;
    return increases.reduce((best, row) =>
      row.variationPercent > best.variationPercent ? row : best,
    );
  }

  get outdatedPriceAlerts(): ProductMarginAlert[] {
    return this.marginAlerts.filter((alert) => !alert.fixedPrice);
  }

  get fixedPriceMarginAlerts(): ProductMarginAlert[] {
    return this.marginAlerts.filter((alert) => alert.fixedPrice);
  }

  /** Alertas mobile: solo productos que pasan búsqueda + tipo + categoría. */
  get mobileOutdatedPriceAlerts(): ProductMarginAlert[] {
    const ids = this.productsMatchingSearchTypeCategoryIds;
    return this.outdatedPriceAlerts.filter((alert) => ids.has(alert.productId));
  }

  get mobileFixedPriceMarginAlerts(): ProductMarginAlert[] {
    const ids = this.productsMatchingSearchTypeCategoryIds;
    return this.fixedPriceMarginAlerts.filter((alert) =>
      ids.has(alert.productId),
    );
  }

  get mobileOutdatedPriceAlertTitle(): string {
    const n = this.mobileOutdatedPriceAlerts.length;
    return n === 1 ? '1 precio bajo el margen' : `${n} precios bajo el margen`;
  }

  get mobileFixedPriceMarginAlertTitle(): string {
    const n = this.mobileFixedPriceMarginAlerts.length;
    return n === 1 ? '1 precio fijo' : `${n} precios fijos`;
  }

  get outdatedPriceAlertMessage(): string {
    const n = this.outdatedPriceAlerts.length;
    return n === 1
      ? '1 producto con el precio bajo el margen respecto de su costo'
      : `${n} productos con el precio bajo el margen respecto de su costo`;
  }

  get fixedPriceMarginAlertMessage(): string {
    const n = this.fixedPriceMarginAlerts.length;
    const base =
      n === 1
        ? '1 producto con precio fijo bajo el margen'
        : `${n} productos con precio fijo bajo el margen`;
    const supply = this.topSupplyIncrease;
    if (!supply) return base;
    const before = this.currency.transform(supply.priceBefore);
    const now = this.currency.transform(supply.priceNow);
    const unit = supply.unit?.trim() ? `/${supply.unit.trim()}` : '';
    return `${base} después del aumento del ${supply.name} (${before} → ${now}${unit})`;
  }

  /** Productos filtrados por búsqueda, tipo y categoría (sin chip de lista). */
  get productsMatchingSearchTypeCategory(): Product[] {
    return this.products.filter((p) => this.matchesSearchTypeCategory(p));
  }

  private get productsMatchingSearchTypeCategoryIds(): Set<string> {
    return new Set(
      this.productsMatchingSearchTypeCategory.map((product) => product.id),
    );
  }

  get filteredProducts(): Product[] {
    return this.products.filter(
      (p) => this.matchesListFilter(p) && this.matchesSearchTypeCategory(p),
    );
  }

  /** Lista para el contador de la hoja: chip + búsqueda (sin tipo/categoría). */
  get productsForSheet(): Product[] {
    return this.products.filter((p) => {
      const matchesList = this.matchesListFilter(p);
      const query = normalizeSearchText(this.search);
      const matchesSearch =
        !query ||
        normalizeSearchText(p.name).includes(query) ||
        normalizeSearchText(
          resolveCategoryNamesText(p.categoryIds, this.categories),
        ).includes(query);
      return matchesList && matchesSearch;
    });
  }

  /** Hay búsqueda o filtros aplicados (la lista vacía no es un catálogo vacío). */
  get hasActiveFilters(): boolean {
    return !!(
      this.search.trim() ||
      this.typeFilter !== 'all' ||
      this.categoryFilter !== 'all' ||
      this.listFilter !== 'all'
    );
  }

  get emptyMessage(): string {
    const term = this.search.trim();
    if (term) return `Sin resultados para '${term}'.`;
    if (this.hasActiveFilters) {
      return 'No hay productos que coincidan con los filtros.';
    }
    return 'No hay productos publicados en el catálogo.';
  }

  clearSearchAndFilters(): void {
    this.search = '';
    this.typeFilter = 'all';
    this.categoryFilter = 'all';
    this.listFilter = 'all';
    this.cdr.markForCheck();
  }

  get visibleCategories(): Category[] {
    if (this.typeFilter === 'all') return this.categories;
    const type = this.typeFilter;
    return this.categories.filter((c) => c.productTypes.includes(type));
  }

  get categoryFilterOptions(): { value: string; label: string }[] {
    return [
      { value: 'all', label: 'Todas' },
      ...this.visibleCategories.map((cat) => ({
        value: cat.id,
        label: cat.name,
      })),
    ];
  }

  get publishedCount(): number {
    return this.products.filter((product) => product.published !== false)
      .length;
  }

  get mobileSheetFilterCount(): number {
    return countProductMobileSheetFilters({
      typeFilter: this.typeFilter,
      categoryFilter: this.categoryFilter,
    });
  }

  get filtersButtonLabel(): string {
    const n = this.mobileSheetFilterCount;
    return n > 0 ? `Tipo y categoría · ${n}` : 'Tipo y categoría';
  }

  reloadProducts(): void {
    this.catalog.loadProducts({ all: true, refresh: true });
    this.catalog.loadAllProducts(true);
  }

  reloadMarginAlerts(): void {
    this.productsService.getMarginAlerts().subscribe({
      next: (alerts) => {
        this.marginAlerts = alerts;
        this.belowMarginIds = new Set(alerts.map((alert) => alert.productId));
        this.cdr.markForCheck();
        // Los banners cambian la altura después del catálogo: reaplicar scroll.
        if (!this.loading) {
          this.listPersistence.onListReady();
        }
      },
      error: () => {
        this.marginAlerts = [];
        this.belowMarginIds = new Set();
        this.cdr.markForCheck();
        if (!this.loading) {
          this.listPersistence.onListReady();
        }
      },
    });
  }

  reloadSupplyPriceChanges(): void {
    this.supplyChangesLoading = true;
    this.cdr.markForCheck();
    this.suppliesService.getPriceChanges(90).subscribe({
      next: (rows) => {
        this.supplyPriceChanges = rows;
        this.supplyChangesLoading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.supplyPriceChanges = [];
        this.supplyChangesLoading = false;
        this.cdr.markForCheck();
      },
    });
  }

  onSearchChange(): void {
    this.cdr.markForCheck();
  }

  setTypeFilter(filter: TypeFilter | string): void {
    this.typeFilter = filter as TypeFilter;
    this.categoryFilter = 'all';
    this.cdr.markForCheck();
  }

  /** Cuántos productos darían estos filtros de desktop (con la búsqueda actual). */
  readonly desktopFilterCount = (draft: Record<string, string>): number =>
    this.products.filter(
      (p) =>
        this.matchesListFilter(p, (draft['list'] ?? 'all') as ListFilter) &&
        this.matchesSearchTypeCategory(
          p,
          (draft['type'] ?? 'all') as TypeFilter,
          draft['category'] ?? 'all',
        ),
    ).length;

  /** Categorías disponibles para un tipo de producto elegido en el panel. */
  readonly categoryOptionsForType = (
    type: string,
  ): { value: string; label: string }[] => [
    { value: 'all', label: 'Todas' },
    ...this.categories
      .filter(
        (c) => type === 'all' || c.productTypes.includes(type as ProductType),
      )
      .map((c) => ({ value: c.id, label: c.name })),
  ];

  applyDesktopFilters(values: Record<string, string>): void {
    this.listFilter = (values['list'] ?? 'all') as ListFilter;
    this.typeFilter = (values['type'] ?? 'all') as TypeFilter;
    this.categoryFilter = values['category'] ?? 'all';
    this.cdr.markForCheck();
  }

  setListFilter(filter: ListFilter | string): void {
    this.listFilter = filter as ListFilter;
    this.cdr.markForCheck();
  }

  onMobileChipChange(chipId: string): void {
    this.setListFilter(chipId);
  }

  openMobileFilters(): void {
    this.formDialogs
      .openProductFilters({
        filters: {
          typeFilter: this.typeFilter,
          categoryFilter: this.categoryFilter,
        },
        typeFilters: this.typeFilters,
        categories: this.categories,
        products: this.productsForSheet,
      })
      .subscribe((next) => {
        if (!next) return;
        this.typeFilter = next.typeFilter;
        this.categoryFilter = next.categoryFilter;
        this.cdr.markForCheck();
      });
  }

  desktopBulkOpen = false;

  /** Muestra el panel de precios en bloque al tocar «Actualizar precios». */
  scrollToBulkPrice(): void {
    this.desktopBulkOpen = true;
    setTimeout(() => {
      this.scrollToBulkPanel();
    });
  }

  private scrollToBulkPanel(): void {
    const el = document.getElementById('masiva');
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  recalculateOutdatedPrices(): void {
    const n = this.breakpoint.isMobile()
      ? this.mobileOutdatedPriceAlerts.length
      : this.outdatedPriceAlerts.length;
    if (n === 0) return;
    this.formDialogs
      .openConfirm({
        title: 'Recalcular precios',
        message:
          n === 1
            ? '¿Recalcular el precio del producto bajo el margen según su costo actual?'
            : `¿Recalcular los precios de ${n} productos bajo el margen según su costo actual?`,
        confirmLabel: 'Recalcular precios',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.productsService.syncPricing().subscribe({
          next: () => {
            this.reloadProducts();
            this.reloadMarginAlerts();
            this.showNotice('Precios recalculados según el costo actual.');
          },
          error: (err) => {
            this.showNotice(
              extractApiErrorMessage(err, 'No se pudieron recalcular los precios'),
            );
          },
        });
      });
  }

  onBulkPriceApplied(): void {
    this.reloadProducts();
    this.reloadMarginAlerts();
    this.showNotice(
      'Precios actualizados. Los pedidos y presupuestos ya enviados mantienen su precio.',
    );
  }

  openCreateProduct(): void {
    this.formDialogs.openProduct().subscribe((saved) => {
      if (saved) {
        this.reloadProducts();
        this.reloadMarginAlerts();
      }
    });
  }

  openEditProduct(product: Product): void {
    this.productsService.getProduct(product.id).subscribe({
      next: (fresh) => {
        this.formDialogs.openProduct(fresh).subscribe((saved) => {
          if (saved) {
            this.reloadProducts();
            this.reloadMarginAlerts();
          }
        });
      },
      error: (err) => {
        this.showNotice(
          extractApiErrorMessage(err, 'No se pudo cargar el producto'),
        );
      },
    });
  }

  deleteProduct(product: Product): void {
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
            this.reloadProducts();
            this.reloadMarginAlerts();
          },
          error: (err) => {
            this.formDialogs
              .openConfirm({
                title: 'No se pudo eliminar',
                message: extractApiErrorMessage(
                  err,
                  'No se pudo eliminar el producto',
                ),
                confirmLabel: 'Entendido',
                alertOnly: true,
              })
              .subscribe();
          },
        });
      });
  }

  openCart(): void {
    if (this.breakpoint.isMobile()) {
      void this.router.navigateByUrl('/ventas/nueva');
      return;
    }
    this.formDialogs.openSale().subscribe();
  }

  addProductToCart(product: Product): void {
    const result = this.saleCart.addProduct(product, 1);
    this.showNotice(
      result.ok
        ? `${product.name} quedó en el carrito de ventas.`
        : (result.error ?? 'No se pudo agregar al carrito'),
    );
  }

  openCategoryForm(): void {
    this.formDialogs.openCategory().subscribe((category) => {
      if (category) {
        this.categoryCatalog.upsert(category);
        this.cdr.markForCheck();
      }
    });
  }

  private applyMobileQueryParams(): boolean {
    const filtro = this.route.snapshot.queryParamMap.get('filtro');
    if (
      filtro === 'below_margin' ||
      filtro === 'fixed_price' ||
      filtro === 'in_stock'
    ) {
      this.listFilter = filtro;
      return true;
    }
    return false;
  }

  /** Para la tarjeta mobile: mismo conjunto que el chip «Bajo margen». */
  isBelowMargin(product: Product): boolean {
    return this.belowMarginIds.has(product.id);
  }

  private matchesSearchTypeCategory(
    product: Product,
    typeFilter: TypeFilter = this.typeFilter,
    categoryFilter: string = this.categoryFilter,
  ): boolean {
    const query = normalizeSearchText(this.search);
    const matchesSearch =
      !query ||
      normalizeSearchText(product.name).includes(query) ||
      normalizeSearchText(
        resolveCategoryNamesText(product.categoryIds, this.categories),
      ).includes(query);
    const matchesType = typeFilter === 'all' || product.type === typeFilter;
    const matchesCategory =
      categoryFilter === 'all' || product.categoryIds.includes(categoryFilter);
    return matchesSearch && matchesType && matchesCategory;
  }

  private matchesListFilter(
    product: Product,
    listFilter: ListFilter = this.listFilter,
  ): boolean {
    switch (listFilter) {
      case 'below_margin':
        return this.belowMarginIds.has(product.id);
      case 'fixed_price':
        return hasFixedCatalogPrice(product);
      case 'in_stock':
        return productListStock(product) > 0;
      case 'internal':
        return product.published === false;
      case 'all':
      default:
        return product.published !== false;
    }
  }

  private showNotice(message: string): void {
    this.cartNotice = message;
    this.cdr.markForCheck();
  }

  private handleRealtime(event: RealtimeEvent): void {
    if (event.scope === 'products' || event.scope === 'all') {
      this.reloadProducts();
      this.reloadMarginAlerts();
      return;
    }

    if (event.scope === 'supplies') {
      this.reloadSupplyPriceChanges();
    }

    this.catalogSync.handleEvent(event);
  }
}
