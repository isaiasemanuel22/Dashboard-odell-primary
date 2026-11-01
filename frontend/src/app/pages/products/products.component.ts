import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
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
} from '@general-components';
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
import { productPhysicalStock } from '../../shared/utils/stock.helpers';
import { normalizeWholesaleDiscount } from '../../shared/utils/wholesale-example.util';
import { FormDialogService } from '../../shared/form-dialogs/public-api';
import { CurrencyArsPipe } from '../../shared/pipes/labels.pipe';
import { ProductsBulkPriceComponent } from './products-bulk-price/products-bulk-price.component';
import { ProductsSupplyPriceChangesComponent } from './products-supply-price-changes/products-supply-price-changes.component';
import { ProductsToolbarComponent } from './products-toolbar/products-toolbar.component';

type TypeFilter = ProductType | 'all';
type ListFilter = 'all' | 'below_margin' | 'fixed_price' | 'in_stock';

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [
    DbSkeletonComponent,
    DbStateMessageComponent,
    DbButtonComponent,
    ProductCardComponent,
    ProductsToolbarComponent,
    ProductsBulkPriceComponent,
    ProductsSupplyPriceChangesComponent,
  ],
  templateUrl: './products.component.html',
  styleUrl: './products.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductsComponent implements OnInit {
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
  private readonly currency = new CurrencyArsPipe();

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
  ];

  ngOnInit(): void {
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
    ];
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

  get marginAlertMessage(): string {
    const n = this.marginAlertCount;
    const base = `${n} ${
      n === 1 ? 'producto quedó' : 'productos quedaron'
    } por debajo de su margen`;
    const supply = this.topSupplyIncrease;
    if (!supply) return base;
    const before = this.currency.transform(supply.priceBefore);
    const now = this.currency.transform(supply.priceNow);
    const unit = supply.unit?.trim() ? `/${supply.unit.trim()}` : '';
    return `${base} después del aumento del ${supply.name} (${before} → ${now}${unit})`;
  }

  get filteredProducts(): Product[] {
    return this.products.filter((p) => {
      const matchesList = this.matchesListFilter(p);
      const query = this.search.trim().toLowerCase();
      const matchesSearch =
        !query ||
        p.name.toLowerCase().includes(query) ||
        resolveCategoryNamesText(p.categoryIds, this.categories)
          .toLowerCase()
          .includes(query);
      const matchesType =
        this.typeFilter === 'all' || p.type === this.typeFilter;
      const matchesCategory =
        this.categoryFilter === 'all' ||
        p.categoryIds.includes(this.categoryFilter);
      return matchesList && matchesSearch && matchesType && matchesCategory;
    });
  }

  get emptyMessage(): string {
    if (
      this.search.trim() ||
      this.typeFilter !== 'all' ||
      this.categoryFilter !== 'all' ||
      this.listFilter !== 'all'
    ) {
      return 'No hay productos que coincidan con la búsqueda.';
    }
    return 'No hay productos publicados en el catálogo.';
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
      },
      error: () => {
        this.marginAlerts = [];
        this.belowMarginIds = new Set();
        this.cdr.markForCheck();
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

  setTypeFilter(filter: TypeFilter | string): void {
    this.typeFilter = filter as TypeFilter;
    this.categoryFilter = 'all';
    this.cdr.markForCheck();
  }

  setListFilter(filter: ListFilter | string): void {
    this.listFilter = filter as ListFilter;
    this.cdr.markForCheck();
  }

  scrollToBulkPrice(): void {
    const el = document.getElementById('masiva');
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
            this.showNotice(
              extractApiErrorMessage(err, 'No se pudo eliminar el producto'),
            );
          },
        });
      });
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

  private matchesListFilter(product: Product): boolean {
    switch (this.listFilter) {
      case 'below_margin':
        return this.belowMarginIds.has(product.id);
      case 'fixed_price':
        return hasFixedCatalogPrice(product);
      case 'in_stock':
        return productPhysicalStock(product) > 0;
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
