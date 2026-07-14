import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import {
  Category,
  Product,
  ProductType,
  isProduct3D,
} from '../../core/models';
import { RealtimeEvent } from '../../core/models/realtime.model';
import { CategoryCatalogService } from '../../core/services/category-catalog.service';
import { ProductCatalogService } from '../../core/services/product-catalog.service';
import { ProductsService } from '../../core/services/products.service';
import { RealtimeCatalogSyncService } from '../../core/services/realtime-catalog-sync.service';
import { RealtimeService } from '../../core/services/realtime.service';
import { removeById, upsertById } from '../../core/utils/replace-in-store';
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
  private readonly productsService = inject(ProductsService);
  private readonly catalogService = inject(ProductCatalogService);
  private readonly categoryCatalog = inject(CategoryCatalogService);
  private readonly catalogSync = inject(RealtimeCatalogSyncService);
  private readonly realtime = inject(RealtimeService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly formDialogs = inject(FormDialogService);

  products: Product[] = [];
  categories: Category[] = [];
  loading = true;
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
    this.loadData();
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

  loadData(): void {
    this.loading = true;
    this.cdr.markForCheck();
    forkJoin({
      products: this.productsService.getProducts(undefined, {
        all: this.publishedFilter !== 'published',
      }),
      categories: this.categoryCatalog.getCategories(),
    }).subscribe({
      next: ({ products, categories }) => {
        this.products = products;
        this.categories = categories;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  setTypeFilter(filter: TypeFilter): void {
    this.typeFilter = filter;
    this.categoryFilter = 'all';
    this.cdr.markForCheck();
  }

  setPublishedFilter(filter: PublishedProductFilter): void {
    if (this.publishedFilter === filter) return;
    this.publishedFilter = filter;
    this.loadData();
  }

  openCreateProduct(): void {
    this.formDialogs.openProduct().subscribe((saved) => {
      if (saved) this.onProductSaved(saved);
    });
  }

  openEditProduct(product: Product): void {
    this.productsService.getProduct(product.id).subscribe({
      next: (fresh) => {
        this.formDialogs.openProduct(fresh).subscribe((saved) => {
          if (saved) this.onProductSaved(saved);
        });
      },
      error: (err) => {
        alert(extractApiErrorMessage(err, 'No se pudo cargar el producto'));
      },
    });
  }

  onProductSaved(saved: Product): void {
    this.products = upsertById(this.products, saved);
    this.cdr.markForCheck();
  }

  deleteProduct(product: Product): void {
    if (!confirm(`¿Eliminar "${product.name}"?`)) return;

    const previous = this.products;
    this.products = removeById(this.products, product.id);
    this.cdr.markForCheck();

    this.productsService.deleteProduct(product.id).subscribe({
      next: () => this.catalogService.remove(product.id),
      error: () => {
        this.products = previous;
        this.cdr.markForCheck();
      },
    });
  }

  openCategoryForm(): void {
    this.formDialogs.openCategory().subscribe((category) => {
      if (category) {
        this.categoryCatalog.upsert(category);
        this.categories = upsertById(this.categories, category);
        this.cdr.markForCheck();
      }
    });
  }

  private handleRealtime(event: RealtimeEvent): void {
    this.catalogSync.handleEvent(event);
    this.loadData();
  }
}
