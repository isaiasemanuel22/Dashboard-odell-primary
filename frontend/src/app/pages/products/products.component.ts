import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
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
  DbListToolbarComponent,
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
import {
  PublishedProductFilter,
  publishedProductFilters,
} from '../../shared/utils/list-filters';
import { FormDialogService } from '../../shared/form-dialogs/public-api';

type TypeFilter = ProductType | 'all';

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    DbStateMessageComponent,
    DbSkeletonComponent,
    DbListToolbarComponent,
    DbButtonComponent,
    ProductCardComponent,
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
  search = '';
  typeFilter: TypeFilter = 'all';
  categoryFilter = 'all';
  publishedFilter: PublishedProductFilter = 'published';

  readonly ProductType = ProductType;
  readonly typeFilters: { value: TypeFilter; label: string }[] = [
    { value: 'all', label: 'Todos' },
    { value: ProductType.FDM, label: 'FDM' },
    { value: ProductType.RESINA, label: 'Resina' },
    { value: ProductType.ESTAMPADO, label: 'Estampado' },
  ];
  readonly publishedFilters = publishedProductFilters();

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
        this.publishedFilter === 'all' ||
        (this.publishedFilter === 'published' && p.published !== false) ||
        (this.publishedFilter === 'unpublished' && p.published === false);
      const matchesSearch =
        !this.search ||
        p.name.toLowerCase().includes(this.search.toLowerCase());
      const matchesType =
        this.typeFilter === 'all' || p.type === this.typeFilter;
      const matchesCategory =
        this.categoryFilter === 'all' ||
        p.categoryIds.includes(this.categoryFilter);
      return (
        matchesPublished && matchesSearch && matchesType && matchesCategory
      );
    });
  }

  get emptyMessage(): string {
    if (this.publishedFilter === 'unpublished') {
      return 'No hay productos no publicados para mostrar.';
    }
    if (this.publishedFilter === 'all') {
      return 'No hay productos para mostrar.';
    }
    return 'No hay productos publicados en el catálogo.';
  }

  get visibleCategories(): Category[] {
    if (this.typeFilter === 'all') return this.categories;
    const type = this.typeFilter;
    return this.categories.filter((c) => c.productTypes.includes(type));
  }

  isProduct3D = isProduct3D;

  reloadProducts(): void {
    this.catalog.loadProducts({
      all: this.publishedFilter !== 'published',
      refresh: true,
    });
    this.catalog.loadAllProducts(true);
  }

  setTypeFilter(filter: TypeFilter): void {
    this.typeFilter = filter;
    this.categoryFilter = 'all';
    this.cdr.markForCheck();
  }

  setPublishedFilter(filter: PublishedProductFilter): void {
    if (this.publishedFilter === filter) return;
    this.publishedFilter = filter;
    this.reloadProducts();
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
        alert(extractApiErrorMessage(err, 'No se pudo cargar el producto'));
      },
    });
  }

  deleteProduct(product: Product): void {
    if (!confirm(`¿Eliminar "${product.name}"?`)) return;

    this.productsService.deleteProduct(product.id).subscribe({
      next: () => this.reloadProducts(),
      error: (err) => {
        alert(extractApiErrorMessage(err, 'No se pudo eliminar el producto'));
      },
    });
  }

  addProductToCart(product: Product): void {
    const result = this.saleCart.addProduct(product, 1);
    if (!result.ok) {
      alert(result.error ?? 'No se pudo agregar al carrito');
    }
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
