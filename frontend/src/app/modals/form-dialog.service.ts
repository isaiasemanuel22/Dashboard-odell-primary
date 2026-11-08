import { Injectable, Type, inject } from '@angular/core';
import { Dialog } from '@angular/cdk/dialog';
import { Overlay } from '@angular/cdk/overlay';
import { Observable, finalize, from, of, switchMap } from 'rxjs';
import {
  Category,
  Customer,
  ImpresoWithCost,
  Order,
  Product,
  ProductType,
  Quote,
  RetailSale,
  Supply,
  SupplyCategory,
} from '../core/models';
import type { CalendarEntry } from '../core/models';
import { BreakpointService } from '../core/services/breakpoint.service';
import { LayoutUiService } from '../layout/layout-ui.service';
import { formDialogConfig } from './form-dialog.config';
import { ModalSize } from './modal-size';
import type { ConfirmDialogData } from './confirm-dialog.component';
import type {
  IndependentTaskDialogData,
  IndependentTaskDialogResult,
} from './independent-task-dialog.component';
import type { SupplyReplacementChoice, SupplyShortageReport } from '../core/models';
import type { OrderFormDialogData } from './order-form-dialog.component';
import type { QuoteDocumentExportDialogData } from './quote-document-export-dialog.component';
import type { CalendarEventDialogData } from './calendar-event-dialog.component';
import type { OrderFiltersSheetData } from './order-filters-sheet.component';
import type { OrderMobileSheetFilters } from '../shared/utils/order.helpers';
import type {
  ProductFiltersSheetData,
  ProductMobileSheetFilters,
} from './product-filters-sheet.component';
import type { QuoteFiltersSheetData } from './quote-filters-sheet.component';
import type { QuoteMobileSheetFilters } from '../shared/utils/quote.helpers';
import type {
  SaleFiltersSheetData,
  SaleMobileSheetFilters,
} from './sale-filters-sheet.component';
import type {
  CalendarFiltersSheetData,
  CalendarMobileFilter,
} from './calendar-filters-sheet.component';
import type {
  PrintJobFiltersSheetData,
  PrintJobMobileSheetFilters,
} from './print-job-filters-sheet.component';

@Injectable({ providedIn: 'root' })
export class FormDialogService {
  private readonly dialog = inject(Dialog);
  private readonly overlay = inject(Overlay);
  private readonly breakpoint = inject(BreakpointService);
  private readonly layoutUi = inject(LayoutUiService);
  /** Evita apilar varios modales de presupuesto por clicks/teclas repetidas. */
  private quoteDialogLocked = false;

  openCustomer(customer: Customer | null = null): Observable<Customer | undefined> {
    return from(import('./customer-form-dialog.component')).pipe(
      switchMap(
        ({ CustomerFormDialogComponent }): Observable<Customer | undefined> =>
          this.open(CustomerFormDialogComponent, { customer }, 'md', {
            ariaLabel: customer ? 'Editar cliente' : 'Nuevo cliente',
            // Desktop: hoja md; mobile: pantalla completa como pedido.
            panelClass: [
              'form-dialog-panel--customer',
              'form-dialog-panel--order-fullscreen',
            ],
            maxWidth: '600px',
          }),
      ),
    );
  }

  openOrder(
    order: Order | null = null,
    options?: {
      presetCustomerId?: string;
      presetCartLines?: OrderFormDialogData['presetCartLines'];
    },
  ): Observable<Order | undefined> {
    return from(import('./order-form-dialog.component')).pipe(
      switchMap(
        ({ OrderFormDialogComponent }): Observable<Order | undefined> =>
          this.open(
            OrderFormDialogComponent,
            {
              order,
              presetCustomerId: options?.presetCustomerId,
              presetCartLines: options?.presetCartLines,
            },
            'xl',
            {
              ariaLabel: order ? 'Editar pedido' : 'Nuevo pedido',
              // Mismo ancho que presupuesto (~1120–1220). En mobile: pantalla completa.
              panelClass: [
                'form-dialog-panel--quote',
                'form-dialog-panel--order-fullscreen',
              ],
              maxWidth: '1120px',
            },
          ),
      ),
    );
  }

  openOrderFromQuote(quote: Quote): Observable<Order | undefined> {
    return from(import('./order-form-dialog.component')).pipe(
      switchMap(
        ({ OrderFormDialogComponent }): Observable<Order | undefined> =>
          this.open(
            OrderFormDialogComponent,
            { order: null, presetQuote: quote },
            'xl',
            {
              ariaLabel: 'Generar pedido desde presupuesto',
              panelClass: [
                'form-dialog-panel--quote',
                'form-dialog-panel--order-fullscreen',
              ],
              maxWidth: '1120px',
            },
          ),
      ),
    );
  }

  openQuote(
    quote: Quote | null = null,
    options?: { presetCustomerId?: string },
  ): Observable<Quote | undefined> {
    if (this.quoteDialogLocked) {
      return of(undefined);
    }
    this.quoteDialogLocked = true;
    return from(import('./quote-form-dialog.component')).pipe(
      switchMap(
        ({ QuoteFormDialogComponent }): Observable<Quote | undefined> =>
          this.open<
            { quote: Quote | null; presetCustomerId?: string },
            Quote
          >(
            QuoteFormDialogComponent,
            {
              quote,
              presetCustomerId: options?.presetCustomerId,
            },
            'xl',
            {
              ariaLabel: quote ? 'Editar presupuesto' : 'Nuevo presupuesto',
              // Mismo ancho desktop; en mobile: pantalla completa como el pedido.
              panelClass: [
                'form-dialog-panel--quote',
                'form-dialog-panel--order-fullscreen',
              ],
              maxWidth: '1120px',
            },
          ),
      ),
      finalize(() => {
        this.quoteDialogLocked = false;
      }),
    );
  }

  openQuoteDocumentExport(
    quote: Quote,
    comparative = false,
  ): Observable<void | undefined> {
    return from(import('./quote-document-export-dialog.component')).pipe(
      switchMap(
        ({
          QuoteDocumentExportDialogComponent,
        }): Observable<void | undefined> =>
          this.open<QuoteDocumentExportDialogData, void>(
            QuoteDocumentExportDialogComponent,
            { quote, comparative },
            'sm',
            {
              ariaLabel: comparative
                ? 'Generar presupuesto comparativo'
                : 'Generar presupuesto',
            },
          ),
      ),
    );
  }

  openCalendarEvent(
    data: CalendarEventDialogData = {},
  ): Observable<CalendarEntry | undefined> {
    return from(import('./calendar-event-dialog.component')).pipe(
      switchMap(
        ({
          CalendarEventDialogComponent,
        }): Observable<CalendarEntry | undefined> =>
          this.open<CalendarEventDialogData, CalendarEntry>(
            CalendarEventDialogComponent,
            data,
            'md',
            {
              ariaLabel: data.entry
                ? 'Editar evento de calendario'
                : 'Nuevo evento de calendario',
              maxWidth: '620px',
            },
          ),
      ),
    );
  }

  openProduct(product: Product | null = null): Observable<Product | undefined> {
    return from(
      import('./product-form-dialog/product-form-dialog.component'),
    ).pipe(
      switchMap(
        ({ ProductFormDialogComponent }): Observable<Product | undefined> =>
          this.open(ProductFormDialogComponent, { product }, 'xl', {
            ariaLabel: product ? 'Editar producto' : 'Nuevo producto',
            // Mobile: pantalla completa como pedido.
            panelClass: ['form-dialog-panel--order-fullscreen'],
          }),
      ),
    );
  }

  openSale(sale: RetailSale | null = null): Observable<RetailSale | undefined> {
    // Import dinámico para evitar ciclo FormDialogService → SaleFormDialog → SaleForm → FormDialogService.
    return from(import('./sale-form-dialog.component')).pipe(
      switchMap(
        ({ SaleFormDialogComponent }): Observable<RetailSale | undefined> =>
          this.open(SaleFormDialogComponent, { sale }, 'wide', {
            ariaLabel: sale ? 'Editar venta' : 'Nueva venta en mostrador',
          }),
      ),
    );
  }

  openCategory(
    presetProductType?: ProductType,
  ): Observable<Category | undefined> {
    return from(
      import('./category-form-dialog/category-form-dialog.component'),
    ).pipe(
      switchMap(
        ({ CategoryFormDialogComponent }): Observable<Category | undefined> =>
          this.open(
            CategoryFormDialogComponent,
            { presetProductType },
            'md',
            { ariaLabel: 'Nueva categoría' },
          ),
      ),
    );
  }

  openSupply(
    supply: Supply | null = null,
    defaultCategory?: SupplyCategory,
  ): Observable<Supply | undefined> {
    return from(import('./supply-form-dialog.component')).pipe(
      switchMap(
        ({ SupplyFormDialogComponent }): Observable<Supply | undefined> =>
          this.open(SupplyFormDialogComponent, { supply, defaultCategory }, 'md', {
            ariaLabel: supply ? 'Editar insumo' : 'Nuevo insumo',
          }),
      ),
    );
  }

  openImpreso(
    impreso: ImpresoWithCost | null = null,
  ): Observable<ImpresoWithCost | undefined> {
    return from(import('./impreso-form-dialog.component')).pipe(
      switchMap(
        ({
          ImpresoFormDialogComponent,
        }): Observable<ImpresoWithCost | undefined> =>
          this.open(ImpresoFormDialogComponent, { impreso }, 'ml', {
            ariaLabel: impreso ? 'Editar impreso' : 'Nuevo impreso',
          }),
      ),
    );
  }

  openResetDatabase(): Observable<boolean | undefined> {
    return from(import('./reset-database-dialog.component')).pipe(
      switchMap(
        ({
          ResetDatabaseDialogComponent,
        }): Observable<boolean | undefined> =>
          this.open(ResetDatabaseDialogComponent, {}, 'sm', {
            ariaLabel: 'Resetear base de datos',
          }),
      ),
    );
  }

  openIndependentTask(
    data: IndependentTaskDialogData,
  ): Observable<IndependentTaskDialogResult | undefined> {
    return from(import('./independent-task-dialog.component')).pipe(
      switchMap(
        ({
          IndependentTaskDialogComponent,
        }): Observable<IndependentTaskDialogResult | undefined> => {
          const base = this.baseConfig('md');
          const ref = this.dialog.open(IndependentTaskDialogComponent, {
            ...base,
            ariaLabel: 'Nueva tarea',
            data,
          });
          return ref.closed as Observable<
            IndependentTaskDialogResult | undefined
          >;
        },
      ),
    );
  }

  openSupplyReplacement(
    data: SupplyShortageReport,
  ): Observable<SupplyReplacementChoice[] | undefined> {
    return from(import('./supply-replacement-dialog.component')).pipe(
      switchMap(
        ({
          SupplyReplacementDialogComponent,
        }): Observable<SupplyReplacementChoice[] | undefined> => {
          const base = this.baseConfig('md');
          const ref = this.dialog.open(SupplyReplacementDialogComponent, {
            ...base,
            ariaLabel: 'Insumos insuficientes',
            data,
          });
          return ref.closed as Observable<SupplyReplacementChoice[] | undefined>;
        },
      ),
    );
  }

  /**
   * `keepOnNavigation`: para confirmaciones que abre un guard al volver con el
   * historial; si no, el diálogo se cierra con esa misma navegación.
   */
  openConfirm(
    data: ConfirmDialogData,
    options: { keepOnNavigation?: boolean } = {},
  ): Observable<boolean> {
    return from(import('./confirm-dialog.component')).pipe(
      switchMap(({ ConfirmDialogComponent }): Observable<boolean> => {
        const base = this.baseConfig('sm');
        const ref = this.dialog.open(ConfirmDialogComponent, {
          ...base,
          ariaLabel: data.title,
          data,
          ...(options.keepOnNavigation ? { closeOnNavigation: false } : {}),
        });
        return ref.closed as Observable<boolean>;
      }),
    );
  }

  openOrderFilters(
    data: OrderFiltersSheetData,
  ): Observable<OrderMobileSheetFilters | undefined> {
    return from(import('./order-filters-sheet.component')).pipe(
      switchMap(
        ({
          OrderFiltersSheetComponent,
        }): Observable<OrderMobileSheetFilters | undefined> =>
          this.open<OrderFiltersSheetData, OrderMobileSheetFilters>(
            OrderFiltersSheetComponent,
            data,
            'md',
            { ariaLabel: 'Filtrar pedidos' },
          ),
      ),
    );
  }

  openProductFilters(
    data: ProductFiltersSheetData,
  ): Observable<ProductMobileSheetFilters | undefined> {
    return from(import('./product-filters-sheet.component')).pipe(
      switchMap(
        ({
          ProductFiltersSheetComponent,
        }): Observable<ProductMobileSheetFilters | undefined> =>
          this.open<ProductFiltersSheetData, ProductMobileSheetFilters>(
            ProductFiltersSheetComponent,
            data,
            'md',
            { ariaLabel: 'Tipo y categoría' },
          ),
      ),
    );
  }

  openQuoteFilters(
    data: QuoteFiltersSheetData,
  ): Observable<QuoteMobileSheetFilters | undefined> {
    return from(import('./quote-filters-sheet.component')).pipe(
      switchMap(
        ({
          QuoteFiltersSheetComponent,
        }): Observable<QuoteMobileSheetFilters | undefined> =>
          this.open<QuoteFiltersSheetData, QuoteMobileSheetFilters>(
            QuoteFiltersSheetComponent,
            data,
            'md',
            { ariaLabel: 'Filtrar presupuestos' },
          ),
      ),
    );
  }

  openSaleFilters(
    data: SaleFiltersSheetData,
  ): Observable<SaleMobileSheetFilters | undefined> {
    return from(import('./sale-filters-sheet.component')).pipe(
      switchMap(
        ({
          SaleFiltersSheetComponent,
        }): Observable<SaleMobileSheetFilters | undefined> =>
          this.open<SaleFiltersSheetData, SaleMobileSheetFilters>(
            SaleFiltersSheetComponent,
            data,
            'md',
            { ariaLabel: 'Filtrar ventas' },
          ),
      ),
    );
  }

  openCalendarFilters(
    data: CalendarFiltersSheetData,
  ): Observable<CalendarMobileFilter | undefined> {
    return from(import('./calendar-filters-sheet.component')).pipe(
      switchMap(
        ({
          CalendarFiltersSheetComponent,
        }): Observable<CalendarMobileFilter | undefined> =>
          this.open<CalendarFiltersSheetData, CalendarMobileFilter>(
            CalendarFiltersSheetComponent,
            data,
            'md',
            { ariaLabel: 'Filtrar calendario' },
          ),
      ),
    );
  }

  openPrintJobFilters(
    data: PrintJobFiltersSheetData,
  ): Observable<PrintJobMobileSheetFilters | undefined> {
    return from(import('./print-job-filters-sheet.component')).pipe(
      switchMap(
        ({
          PrintJobFiltersSheetComponent,
        }): Observable<PrintJobMobileSheetFilters | undefined> =>
          this.open<PrintJobFiltersSheetData, PrintJobMobileSheetFilters>(
            PrintJobFiltersSheetComponent,
            data,
            'md',
            { ariaLabel: 'Filtrar cola' },
          ),
      ),
    );
  }

  /**
   * Precarga en idle los diálogos más usados (sin abrirlos).
   * Así el primer toque no espera el `import()` dinámico.
   */
  prefetchCommon(): void {
    void import('./order-form-dialog.component').catch(() => undefined);
    void import('./confirm-dialog.component').catch(() => undefined);
    void import('./customer-form-dialog.component').catch(() => undefined);
    void import('./quote-form-dialog.component').catch(() => undefined);
  }

  private baseConfig(size: ModalSize) {
    return formDialogConfig(size, {
      isMobile: this.breakpoint.isMobile(),
      overlay: this.overlay,
    });
  }

  private open<TData, TResult>(
    component: Type<unknown>,
    data: TData,
    size: ModalSize,
    overrides: {
      ariaLabel: string;
      panelClass?: string[];
      maxWidth?: string;
    },
  ): Observable<TResult | undefined> {
    const base = this.baseConfig(size);
    const isMobile = this.breakpoint.isMobile();
    if (isMobile) {
      this.layoutUi.pushOverlay();
    }
    const ref = this.dialog.open(component, {
      ...base,
      panelClass: [...base.panelClass, ...(overrides.panelClass ?? [])],
      maxWidth: isMobile ? '100%' : (overrides.maxWidth ?? base.maxWidth),
      ariaLabel: overrides.ariaLabel,
      data,
    });
    return (ref.closed as Observable<TResult | undefined>).pipe(
      finalize(() => {
        if (isMobile) {
          this.layoutUi.popOverlay();
        }
      }),
    );
  }
}
