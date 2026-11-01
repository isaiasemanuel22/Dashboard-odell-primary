import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  EventEmitter,
  Input,
  OnInit,
  Output,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import {
  Subject,
  catchError,
  debounceTime,
  of,
  switchMap,
  tap,
} from 'rxjs';
import {
  BulkPricePayload,
  BulkPricePreviewItem,
  BulkPricePreviewResult,
  BulkPriceScope,
  Category,
  FilamentType,
} from '../../../core/models';
import { ProductsService } from '../../../core/services/products.service';
import {
  DB_DATA_TABLE,
  DbButtonComponent,
  DbInputComponent,
  DbSelectComponent,
  DbSelectOption,
  OdlColumn,
} from '@general-components';
import { FormDialogService } from '../../../shared/form-dialogs/public-api';
import { extractApiErrorMessage } from '../../../shared/utils/api-error';
import { filamentTypeOptions } from '../../../shared/utils/select-options';

type RoundTo = BulkPricePayload['roundTo'];

@Component({
  selector: 'app-products-bulk-price',
  standalone: true,
  imports: [
    FormsModule,
    DbButtonComponent,
    DbInputComponent,
    DbSelectComponent,
    ...DB_DATA_TABLE,
  ],
  templateUrl: './products-bulk-price.component.html',
  styleUrl: './products-bulk-price.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductsBulkPriceComponent implements OnInit {
  private readonly productsService = inject(ProductsService);
  private readonly formDialogs = inject(FormDialogService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly previewTrigger$ = new Subject<void>();

  @Input() categories: Category[] = [];
  @Output() applied = new EventEmitter<void>();

  scope: BulkPriceScope = 'all';
  categoryId = '';
  filamentType: FilamentType | '' = '';
  percent: number | null = 10;
  roundTo = '100';

  preview: BulkPricePreviewResult | null = null;
  previewLoading = false;
  applying = false;
  error = '';
  percentError = '';

  readonly scopeOptions: DbSelectOption[] = [
    { value: 'all', label: 'Todo el catálogo' },
    { value: 'category', label: 'Categoría…' },
    { value: 'filament_type', label: 'Filamento…' },
  ];

  readonly roundOptions: DbSelectOption[] = [
    { value: '100', label: '$ 100' },
    { value: '500', label: '$ 500' },
    { value: '0', label: 'Sin redondeo' },
  ];

  readonly filamentOptions: DbSelectOption[] = filamentTypeOptions();

  readonly columns: OdlColumn<BulkPricePreviewItem>[] = [
    { key: 'name', header: 'Producto', type: 'primary' },
    {
      key: 'currentPrice',
      header: 'Precio actual',
      type: 'money',
      align: 'end',
    },
    {
      key: 'newPrice',
      header: 'Precio nuevo',
      type: 'money',
      align: 'end',
    },
    {
      key: 'newWholesalePrice',
      header: 'Mayorista nuevo',
      type: 'money',
      align: 'end',
    },
    {
      key: 'newMarkupPercent',
      header: 'Margen nuevo',
      type: 'number',
      align: 'end',
    },
  ];

  get categoryOptions(): DbSelectOption[] {
    return this.categories.map((cat) => ({
      value: cat.id,
      label: cat.name,
    }));
  }

  get previewCount(): number {
    return this.preview?.count ?? 0;
  }

  get canApply(): boolean {
    return (
      this.previewCount > 0 &&
      !this.previewLoading &&
      !this.applying &&
      !this.percentError
    );
  }

  get applyLabel(): string {
    if (this.applying) return 'Aplicando…';
    if (this.previewCount <= 0) return 'Aplicar';
    return `Aplicar a ${this.previewCount} ${
      this.previewCount === 1 ? 'producto' : 'productos'
    }`;
  }

  ngOnInit(): void {
    this.previewTrigger$
      .pipe(
        debounceTime(350),
        tap(() => {
          this.previewLoading = true;
          this.error = '';
          this.cdr.markForCheck();
        }),
        switchMap(() => {
          const payload = this.buildPayload();
          if (!payload) {
            this.preview = null;
            this.previewLoading = false;
            this.cdr.markForCheck();
            return of(null);
          }
          return this.productsService.previewBulkPrice(payload).pipe(
            catchError((err) => {
              this.error = extractApiErrorMessage(
                err,
                'No se pudo previsualizar el aumento',
              );
              this.preview = null;
              this.previewLoading = false;
              this.cdr.markForCheck();
              return of(null);
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        if (result) {
          this.preview = result;
          this.previewLoading = false;
          this.cdr.markForCheck();
        }
      });

    this.queuePreview();
  }

  onFieldChange(): void {
    this.validatePercent();
    this.queuePreview();
  }

  onScopeChange(value: BulkPriceScope | string): void {
    this.scope = value as BulkPriceScope;
    if (this.scope !== 'category') this.categoryId = '';
    if (this.scope !== 'filament_type') this.filamentType = '';
    this.onFieldChange();
  }

  cancel(): void {
    this.scope = 'all';
    this.categoryId = '';
    this.filamentType = '';
    this.percent = 10;
    this.roundTo = '100';
    this.percentError = '';
    this.error = '';
    this.preview = null;
    this.queuePreview();
    this.cdr.markForCheck();
  }

  apply(): void {
    const payload = this.buildPayload();
    if (!payload || !this.canApply) return;

    const count = this.previewCount;
    this.formDialogs
      .openConfirm({
        title: 'Aplicar aumento de precios',
        message: `¿Aplicar el aumento a ${count} ${
          count === 1 ? 'producto' : 'productos'
        }? Los pedidos y presupuestos ya enviados mantienen su precio.`,
        confirmLabel: `Aplicar a ${count} ${
          count === 1 ? 'producto' : 'productos'
        }`,
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.applying = true;
        this.error = '';
        this.cdr.markForCheck();
        this.productsService.applyBulkPrice(payload).subscribe({
          next: () => {
            this.applying = false;
            this.applied.emit();
            this.queuePreview();
            this.cdr.markForCheck();
          },
          error: (err) => {
            this.applying = false;
            this.error = extractApiErrorMessage(
              err,
              'No se pudo aplicar el aumento',
            );
            this.cdr.markForCheck();
          },
        });
      });
  }

  formatMargin(value: number | null | undefined): string {
    if (value == null || !Number.isFinite(Number(value))) return '—';
    return `${Math.round(Number(value))}%`;
  }

  private validatePercent(): void {
    const value = Number(this.percent);
    if (!Number.isFinite(value) || value === 0) {
      this.percentError = 'El aumento tiene que ser distinto de 0';
      return;
    }
    if (value < -50 || value > 200) {
      this.percentError = 'El aumento tiene que estar entre −50 y 200';
      return;
    }
    this.percentError = '';
  }

  private buildPayload(): BulkPricePayload | null {
    this.validatePercent();
    if (this.percentError) return null;

    const percent = Number(this.percent);
    if (!Number.isFinite(percent) || percent === 0) return null;

    if (this.scope === 'category' && !this.categoryId) return null;
    if (this.scope === 'filament_type' && !this.filamentType) return null;

    const roundTo = Number(this.roundTo);
    if (roundTo !== 0 && roundTo !== 100 && roundTo !== 500) {
      return null;
    }

    const payload: BulkPricePayload = {
      scope: this.scope,
      percent,
      roundTo: roundTo as RoundTo,
    };
    if (this.scope === 'category') {
      payload.categoryId = this.categoryId;
    }
    if (this.scope === 'filament_type') {
      payload.filamentType = this.filamentType as FilamentType;
    }
    return payload;
  }

  private queuePreview(): void {
    this.previewTrigger$.next();
  }
}
