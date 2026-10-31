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
  ProductType,
  isProduct3D,
} from '../../core/models';
import { RealtimeEvent } from '../../core/models/realtime.model';
import { CategoryCatalogService } from '../../core/services/category-catalog.service';
import { ProductsService } from '../../core/services/products.service';
import { RealtimeCatalogSyncService } from '../../core/services/realtime-catalog-sync.service';
import { RealtimeService } from '../../core/services/realtime.service';
import { SaleCartService } from '../../core/services/sale-cart.service';
import { CatalogFacade } from '../../store/catalog/catalog.facade';
import {
  DbSkeletonComponent,
  DbStateMessageComponent,
  DbButtonComponent,
  ProductCardComponent,
} from '@general-components';
import { extractApiErrorMessage } from '../../shared/utils/api-error';
import {
  clearCreateQuery,
  shouldOpenCreateFromQuery,
} from '../../shared/utils/create-from-query.util';
import { productPhysicalStock } from '../../shared/utils/stock.helpers';
import { resolveCategoryNamesText } from '../../shared/utils/product.helpers';
import { FormDialogService } from '../../shared/form-dialogs/public-api';
import { ProductsToolbarComponent } from './products-toolbar/products-toolbar.component';

type TypeFilter = ProductType | 'all';
type CatalogView = 'published' | 'unpublished' | 'instock' | 'all';

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [
    DbSkeletonComponent,
    DbStateMessageComponent,
    DbButtonComponent,
    ProductCardComponent,
    ProductsToolbarComponent,
  ],
  templateUrl: './products.component.html',
  styleUrl: './products.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductsComponent implements OnInit {
  private readonly catalog = inject(CatalogFacade);
  private readonly productsService = inject(ProductsService);
  private readonly categoryCatalog = inject(CategoryCatalogService);
  private readonly catalogSync = inject(RealtimeCatalogSyncService);
  private readonly realtime = inject(RealtimeService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly formDialogs = inject(FormDialogService);
  private readonly saleCart = inject(SaleCartService);

  products: Product[] = [];
  categories: Category[] = [];
  loading = true;
  cartItemCount = 0;
  cartNotice = '';
  search = '';
  typeFilter: TypeFilter = 'all';
  categoryFilter = 'all';
  publishedFilter: 'published' | 'unpublished' | 'all' = 'published';
  catalogView: CatalogView = 'published';

  readonly ProductType = ProductType;
  readonly typeFilters: { value: TypeFilter; label: string }[] = [
    { value: 'all', label: 'Todos' },
    { value: ProductType.FDM, label: 'FDM' },
    { value: ProductType.RESINA, label: 'Resina' },
    { value: ProductType.ESTAMPADO, label: 'Estampado' },
  ];
  readonly catalogFilters: { value: CatalogView; label: string }[] = [
    { value: 'published', label: 'Publicados' },
    { value: 'unpublished', label: 'No publicados' },
    { value: 'instock', label: 'Con stock' },
    { value: 'all', label: 'Todos' },
  ];

  ngOnInit(): void {
    this.catalog.load();
    combineLatest([
      this.catalog.products$,
      this.catalog.loading$,
      this.catalog.categories$,
    ])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([products, loading, categories]) => {
        this.products = products;
        this.loading = loading;
        this.categories = categories;
        this.cdr.markForCheck();
      });

    this.reloadProducts();

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

  get filteredProducts(): Product[] {
    return this.products.filter((p) => {
      const matchesPublished =
        this.catalogView === 'all' ||
        this.catalogView === 'instock' ||
        (this.catalogView === 'published' && p.published !== false) ||
        (this.catalogView === 'unpublished' && p.published === false);
      const matchesStock =
        this.catalogView !== 'instock' || productPhysicalStock(p) > 0;
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
      return (
        matchesPublished && matchesStock && matchesSearch && matchesType && matchesCategory
      );
    });
  }

  get emptyMessage(): string {
    if (
      this.search.trim() ||
      this.typeFilter !== 'all' ||
      this.categoryFilter !== 'all'
    ) {
      return 'No hay productos que coincidan con la búsqueda.';
    }
    if (this.catalogView === 'unpublished') {
      return 'No hay productos no publicados para mostrar.';
    }
    if (this.catalogView === 'instock') {
      return 'No hay productos con stock.';
    }
    if (this.catalogView === 'all') {
      return 'No hay productos para mostrar.';
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
      ...this.visibleCategories.map((cat) => ({ value: cat.id, label: cat.name })),
    ];
  }

  isProduct3D = isProduct3D;

  reloadProducts(): void {
    this.catalog.loadProducts({
      all: this.publishedFilter !== 'published',
      refresh: true,
    });
    this.catalog.loadAllProducts(true);
  }

  setTypeFilter(filter: TypeFilter | string): void {
    this.typeFilter = filter as TypeFilter;
    this.categoryFilter = 'all';
    this.cdr.markForCheck();
  }

  get publishedCount(): number {
    return this.products.filter((product) => product.published !== false).length;
  }

  get inStockCount(): number {
    return this.products.filter((product) => productPhysicalStock(product) > 0).length;
  }

  setCatalogView(view: CatalogView | string): void {
    const next = view as CatalogView;
    if (this.catalogView === next) return;
    this.catalogView = next;
    const published =
      next === 'unpublished' ? 'unpublished' : next === 'published' ? 'published' : 'all';
    if (this.publishedFilter !== published) {
      this.publishedFilter = published;
      this.reloadProducts();
    }
    this.cdr.markForCheck();
  }

  openCreateProduct(): void {
    this.formDialogs.openProduct().subscribe((saved) => {
      if (saved) this.reloadProducts();
    });
  }

  openEditProduct(product: Product): void {
    this.productsService.getProduct(product.id).subscribe({
      next: (fresh) => {
        this.formDialogs.openProduct(fresh).subscribe((saved) => {
          if (saved) this.reloadProducts();
        });
      },
      error: (err) => {
        this.showNotice(extractApiErrorMessage(err, 'No se pudo cargar el producto'));
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
          next: () => this.reloadProducts(),
          error: (err) => {
            this.showNotice(extractApiErrorMessage(err, 'No se pudo eliminar el producto'));
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

  private showNotice(message: string): void {
    this.cartNotice = message;
    this.cdr.markForCheck();
  }

  openCategoryForm(): void {
    this.formDialogs.openCategory().subscribe((category) => {
      if (category) {
        this.categoryCatalog.upsert(category);
        this.cdr.markForCheck();
      }
    });
  }

  private handleRealtime(event: RealtimeEvent): void {
    if (event.scope === 'products' || event.scope === 'all') {
      this.reloadProducts();
      return;
    }

    this.catalogSync.handleEvent(event);
  }
}
