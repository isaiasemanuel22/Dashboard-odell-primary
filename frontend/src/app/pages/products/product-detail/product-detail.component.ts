import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, map, of, switchMap } from 'rxjs';
import {
  Category,
  Product,
  isProduct3D,
} from '../../../core/models';
import { RealtimeEvent } from '../../../core/models/realtime.model';
import { CategoryCatalogService } from '../../../core/services/category-catalog.service';
import { ProductCatalogService } from '../../../core/services/product-catalog.service';
import { ProductsService } from '../../../core/services/products.service';
import { RealtimeCatalogSyncService } from '../../../core/services/realtime-catalog-sync.service';
import { RealtimeService } from '../../../core/services/realtime.service';
import {
  DbButtonComponent,
  DbSkeletonComponent,
  DbStateMessageComponent,
  ProductBadgesComponent,
  ProductComponentsTableComponent,
  ProductPricingComponent,
} from '@general-components';
import { FormDialogService } from '../../../shared/form-dialogs/public-api';
import { extractApiErrorMessage } from '../../../shared/utils/api-error';
import { resolveCategoryNames, isProductPublished } from '../../../shared/utils/product.helpers';
import {
  DateShortPipe,
  FilamentTypeLabelPipe,
  ResinTypeLabelPipe,
} from '../../../shared/pipes/labels.pipe';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [
    RouterLink,
    DateShortPipe,
    FilamentTypeLabelPipe,
    ResinTypeLabelPipe,
    DbButtonComponent,
    DbSkeletonComponent,
    DbStateMessageComponent,
    ProductBadgesComponent,
    ProductPricingComponent,
    ProductComponentsTableComponent,
  ],
  templateUrl: './product-detail.component.html',
  styleUrl: './product-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductDetailComponent implements OnInit {
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

  product: Product | null = null;
  categories: Category[] = [];
  catalogProducts: Product[] = [];
  loading = true;
  notFound = false;
  selectedImageIndex = 0;

  publishLoading = false;

  isProduct3D = isProduct3D;

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        map((params) => params.get('id')),
        switchMap((id) => this.loadProduct(id)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        if (!result) return;
        this.product = result.product;
        this.categories = result.categories;
        this.catalogProducts = result.catalog;
        this.loading = false;
        this.cdr.markForCheck();
      });

    this.realtime.bindSmartReload(
      this.destroyRef,
      'products',
      (event) => this.handleRealtime(event),
      {
        skip: () => this.publishLoading,
      },
    );
  }

  get categoryNames(): string[] {
    if (!this.product) return [];
    return resolveCategoryNames(this.product.categoryIds, this.categories);
  }

  get selectedImage(): string | null {
    if (!this.product?.images.length) return null;
    return this.product.images[this.selectedImageIndex] ?? this.product.images[0];
  }

  get hasComponents(): boolean {
    return (this.product?.components?.length ?? 0) > 0;
  }

  get isPublished(): boolean {
    return this.product ? isProductPublished(this.product) : false;
  }

  get publishActionLabel(): string {
    return this.isPublished ? 'Despublicar' : 'Publicar';
  }

  selectImage(index: number): void {
    this.selectedImageIndex = index;
    this.cdr.markForCheck();
  }

  openEdit(): void {
    if (!this.product) return;

    this.productsService.getProduct(this.product.id).subscribe({
      next: (fresh) => {
        this.formDialogs.openProduct(fresh).subscribe((updated) => {
          if (!updated) return;
          this.product = updated;
          this.catalogService.upsert(updated);
          this.cdr.markForCheck();
        });
      },
      error: (err) => {
        alert(extractApiErrorMessage(err, 'No se pudo cargar el producto'));
      },
    });
  }

  deleteProduct(): void {
    if (!this.product) return;
    if (!confirm(`¿Eliminar "${this.product.name}"?`)) return;

    const id = this.product.id;
    this.productsService.deleteProduct(id).subscribe({
      next: () => {
        this.catalogService.remove(id);
        this.router.navigate(['/productos']);
      },
    });
  }

  togglePublished(): void {
    if (!this.product || this.publishLoading) return;

    const nextPublished = !this.isPublished;
    const action = nextPublished ? 'publicar' : 'despublicar';
    if (!confirm(`¿${action.charAt(0).toUpperCase()}${action.slice(1)} "${this.product.name}" en el catálogo?`)) {
      return;
    }

    const previous = this.product;
    this.product = { ...this.product, published: nextPublished };
    this.publishLoading = true;
    this.cdr.markForCheck();

    this.productsService
      .updateProduct(previous.id, { published: nextPublished })
      .subscribe({
        next: (updated) => {
          this.publishLoading = false;
          this.product = updated;
          this.catalogService.upsert(updated);
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.publishLoading = false;
          this.product = previous;
          this.cdr.markForCheck();
          alert(
            extractApiErrorMessage(
              err,
              `No se pudo ${action} el producto`,
            ),
          );
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
      this.categories = result.categories;
      this.catalogProducts = result.catalog;
      this.loading = false;
      this.cdr.markForCheck();
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
    this.selectedImageIndex = 0;
    this.cdr.markForCheck();

    return this.productsService.getProductOverview(id).pipe(
      map(({ product, categories, catalogProducts }) => ({
        product,
        categories,
        catalog: catalogProducts,
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
