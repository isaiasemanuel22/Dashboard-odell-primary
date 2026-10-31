import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
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
  Product,
  Product3D,
  ProductAttachment,
  ProductStockOverview,
  isProduct3D,
} from '../../../core/models';
import { RealtimeEvent } from '../../../core/models/realtime.model';
import { CategoryCatalogService } from '../../../core/services/category-catalog.service';
import { MediaUploadService } from '../../../core/services/media-upload.service';
import { ProductCatalogService } from '../../../core/services/product-catalog.service';
import { ProductsService } from '../../../core/services/products.service';
import { RealtimeCatalogSyncService } from '../../../core/services/realtime-catalog-sync.service';
import { RealtimeService } from '../../../core/services/realtime.service';
import { SettingsService } from '../../../core/services/settings.service';
import { productStockOverview } from '../../../shared/utils/stock.helpers';
import { ProductDetailProductionComponent } from './product-detail-production/product-detail-production.component';
import {
  DbAttachmentUploadComponent,
  DbAttachmentUploadFn,
  DbButtonComponent,
  DbSkeletonComponent,
  DbStateMessageComponent,
  ProductBadgesComponent,
  ProductComponentsTableComponent,
  ProductImageCarouselComponent,
  ProductPricingComponent,
} from '@general-components';
import { normalizeProductAttachments } from '../../../shared/utils/product-attachment.helpers';
import { FormDialogService } from '../../../shared/form-dialogs/public-api';
import { extractApiErrorMessage } from '../../../shared/utils/api-error';
import {
  isProductPublished,
  normalizeProductComponents,
  resolveCategoryNames,
} from '../../../shared/utils/product.helpers';
import { DateShortPipe } from '../../../shared/pipes/labels.pipe';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    DateShortPipe,
    DbButtonComponent,
    DbAttachmentUploadComponent,
    DbSkeletonComponent,
    DbStateMessageComponent,
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
  private readonly mediaUpload = inject(MediaUploadService);
  private readonly settingsService = inject(SettingsService);
  product: Product | null = null;
  colorCatalog: ColorConfig[] = [];
  attachments: ProductAttachment[] = [];
  categories: Category[] = [];
  catalogProducts: Product[] = [];
  stock: ProductStockOverview | null = null;
  loading = true;
  notFound = false;

  publishLoading = false;
  attachmentsSaving = false;
  attachmentsError = '';

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
        this.colorCatalog = settings.colors ?? [];
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

  get isPublished(): boolean {
    return this.product ? isProductPublished(this.product) : false;
  }

  get publishActionLabel(): string {
    return this.isPublished ? 'Despublicar' : 'Publicar';
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
        this.catalogService.loadProducts({ all: true, refresh: true });
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
          this.catalogService.loadProducts({ all: true, refresh: true });
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
