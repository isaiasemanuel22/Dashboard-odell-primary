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
} from '../../core/models';
import type { CalendarEntry } from '../../core/models';
import { BreakpointService } from '../../core/services/breakpoint.service';
import { formDialogConfig } from './form-dialog.config';
import { ModalSize } from './modal-size';
import type { ConfirmDialogData } from './confirm-dialog.component';
import type { OrderFormDialogData } from './order-form-dialog.component';
import type { QuoteDocumentExportDialogData } from './quote-document-export-dialog.component';
import type { CalendarEventDialogData } from './calendar-event-dialog.component';

@Injectable({ providedIn: 'root' })
export class FormDialogService {
  private readonly dialog = inject(Dialog);
  private readonly overlay = inject(Overlay);
  private readonly breakpoint = inject(BreakpointService);
  /** Evita apilar varios modales de presupuesto por clicks/teclas repetidas. */
  private quoteDialogLocked = false;

  openCustomer(customer: Customer | null = null): Observable<Customer | undefined> {
    return from(import('./customer-form-dialog.component')).pipe(
      switchMap(
        ({ CustomerFormDialogComponent }): Observable<Customer | undefined> =>
          this.open(CustomerFormDialogComponent, { customer }, 'md', {
            ariaLabel: customer ? 'Editar cliente' : 'Nuevo cliente',
            panelClass: ['form-dialog-panel--customer'],
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
              // Mismo ancho que presupuesto (~1120–1220).
              panelClass: ['form-dialog-panel--quote'],
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
              panelClass: ['form-dialog-panel--quote'],
              maxWidth: '1120px',
            },
          ),
      ),
    );
  }

  openQuote(quote: Quote | null = null): Observable<Quote | undefined> {
    if (this.quoteDialogLocked) {
      return of(undefined);
    }
    this.quoteDialogLocked = true;
    return from(import('./quote-form-dialog.component')).pipe(
      switchMap(
        ({ QuoteFormDialogComponent }): Observable<Quote | undefined> =>
          this.open<{ quote: Quote | null }, Quote>(
            QuoteFormDialogComponent,
            { quote },
            'xl',
            {
              ariaLabel: quote ? 'Editar presupuesto' : 'Nuevo presupuesto',
              panelClass: ['form-dialog-panel--quote'],
              maxWidth: '1120px',
            },
          ),
      ),
      finalize(() => {
        this.quoteDialogLocked = false;
      }),
    );
  }

  openQuoteDocumentExport(quote: Quote): Observable<void | undefined> {
    return from(import('./quote-document-export-dialog.component')).pipe(
      switchMap(
        ({
          QuoteDocumentExportDialogComponent,
        }): Observable<void | undefined> =>
          this.open<QuoteDocumentExportDialogData, void>(
            QuoteDocumentExportDialogComponent,
            { quote },
            'sm',
            { ariaLabel: 'Generar presupuesto' },
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
      import('../../components/product-form-dialog/product-form-dialog.component'),
    ).pipe(
      switchMap(
        ({ ProductFormDialogComponent }): Observable<Product | undefined> =>
          this.open(ProductFormDialogComponent, { product }, 'xl', {
            ariaLabel: product ? 'Editar producto' : 'Nuevo producto',
          }),
      ),
    );
  }

  openSale(sale: RetailSale | null = null): Observable<RetailSale | undefined> {
    // Import dinámico para evitar ciclo FormDialogService → SaleFormDialog → SaleForm → FormDialogService.
    return from(import('./sale-form-dialog.component')).pipe(
      switchMap(
        ({ SaleFormDialogComponent }): Observable<RetailSale | undefined> =>
          this.open(SaleFormDialogComponent, { sale }, 'lg', {
            ariaLabel: sale ? 'Editar venta' : 'Nueva venta en mostrador',
          }),
      ),
    );
  }

  openCategory(
    presetProductType?: ProductType,
  ): Observable<Category | undefined> {
    return from(
      import('../../components/category-form-dialog/category-form-dialog.component'),
    ).pipe(
      switchMap(
        ({ CategoryFormDialogComponent }): Observable<Category | undefined> =>
          this.open(
            CategoryFormDialogComponent,
            { presetProductType },
            'sm',
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
          this.open(ImpresoFormDialogComponent, { impreso }, 'md', {
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

  openConfirm(data: ConfirmDialogData): Observable<boolean> {
    return from(import('./confirm-dialog.component')).pipe(
      switchMap(({ ConfirmDialogComponent }): Observable<boolean> => {
        const base = this.baseConfig('sm');
        const ref = this.dialog.open(ConfirmDialogComponent, {
          ...base,
          ariaLabel: data.title,
          data,
        });
        return ref.closed as Observable<boolean>;
      }),
    );
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
    const ref = this.dialog.open(component, {
      ...base,
      panelClass: [...base.panelClass, ...(overrides.panelClass ?? [])],
      maxWidth: isMobile ? '100%' : (overrides.maxWidth ?? base.maxWidth),
      ariaLabel: overrides.ariaLabel,
      data,
    });
    return ref.closed as Observable<TResult | undefined>;
  }
}
