import { Injectable, Type, inject } from '@angular/core';
import { Dialog } from '@angular/cdk/dialog';
import { Observable } from 'rxjs';
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
import { formDialogConfig } from './form-dialog.config';
import { ModalSize } from './modal-size';
import { CategoryFormDialogComponent } from '../../components/category-form-dialog/category-form-dialog.component';
import { ConfirmDialogComponent, ConfirmDialogData } from './confirm-dialog.component';
import { CustomerFormDialogComponent } from './customer-form-dialog.component';
import { ImpresoFormDialogComponent } from './impreso-form-dialog.component';
import { OrderFormDialogComponent } from './order-form-dialog.component';
import { QuoteFormDialogComponent } from './quote-form-dialog.component';
import type { OrderFormDialogData } from './order-form-dialog.component';
import {
  QuoteDocumentExportDialogComponent,
  QuoteDocumentExportDialogData,
} from './quote-document-export-dialog.component';
import {
  CalendarEventDialogComponent,
  CalendarEventDialogData,
} from './calendar-event-dialog.component';
import { CalendarEntry } from '../../core/models';
import { ProductFormDialogComponent } from '../../components/product-form-dialog/product-form-dialog.component';
import { ResetDatabaseDialogComponent } from './reset-database-dialog.component';
import { SaleFormDialogComponent } from './sale-form-dialog.component';
import { SupplyFormDialogComponent } from './supply-form-dialog.component';

@Injectable({ providedIn: 'root' })
export class FormDialogService {
  private readonly dialog = inject(Dialog);

  openCustomer(customer: Customer | null = null): Observable<Customer | undefined> {
    return this.open(CustomerFormDialogComponent, { customer }, 'md', {
      ariaLabel: customer ? 'Editar cliente' : 'Nuevo cliente',
      panelClass: ['form-dialog-panel--customer'],
      maxWidth: '520px',
    });
  }

  openOrder(
    order: Order | null = null,
    options?: {
      presetCustomerId?: string;
      presetCartLines?: OrderFormDialogData['presetCartLines'];
    },
  ): Observable<Order | undefined> {
    return this.open(
      OrderFormDialogComponent,
      {
        order,
        presetCustomerId: options?.presetCustomerId,
        presetCartLines: options?.presetCartLines,
      },
      'lg',
      {
        ariaLabel: order ? 'Editar pedido' : 'Nuevo pedido',
      },
    );
  }

  openOrderFromQuote(quote: Quote): Observable<Order | undefined> {
    return this.open(
      OrderFormDialogComponent,
      { order: null, presetQuote: quote },
      'lg',
      { ariaLabel: 'Generar pedido desde presupuesto' },
    );
  }

  openQuote(quote: Quote | null = null): Observable<Quote | undefined> {
    return this.open(QuoteFormDialogComponent, { quote }, 'xl', {
      ariaLabel: quote ? 'Editar presupuesto' : 'Nuevo presupuesto',
      panelClass: ['form-dialog-panel--quote'],
      maxWidth: '1120px',
    });
  }

  openQuoteDocumentExport(quote: Quote): Observable<void | undefined> {
    return this.open<QuoteDocumentExportDialogData, void>(
      QuoteDocumentExportDialogComponent,
      { quote },
      'sm',
      { ariaLabel: 'Generar presupuesto' },
    );
  }

  openCalendarEvent(
    data: CalendarEventDialogData = {},
  ): Observable<CalendarEntry | undefined> {
    return this.open<CalendarEventDialogData, CalendarEntry>(
      CalendarEventDialogComponent,
      data,
      'md',
      {
        ariaLabel: data.entry
          ? 'Editar evento de calendario'
          : 'Nuevo evento de calendario',
        maxWidth: '620px',
      },
    );
  }

  openProduct(product: Product | null = null): Observable<Product | undefined> {
    return this.open(ProductFormDialogComponent, { product }, 'xl', {
      ariaLabel: product ? 'Editar producto' : 'Nuevo producto',
    });
  }

  openSale(sale: RetailSale | null = null): Observable<RetailSale | undefined> {
    return this.open(SaleFormDialogComponent, { sale }, 'lg', {
      ariaLabel: sale ? 'Editar venta' : 'Nueva venta en mostrador',
    });
  }

  openCategory(
    presetProductType?: ProductType,
  ): Observable<Category | undefined> {
    return this.open(
      CategoryFormDialogComponent,
      { presetProductType },
      'sm',
      { ariaLabel: 'Nueva categoría' },
    );
  }

  openSupply(
    supply: Supply | null = null,
    defaultCategory?: SupplyCategory,
  ): Observable<Supply | undefined> {
    return this.open(SupplyFormDialogComponent, { supply, defaultCategory }, 'md', {
      ariaLabel: supply ? 'Editar insumo' : 'Nuevo insumo',
    });
  }

  openImpreso(
    impreso: ImpresoWithCost | null = null,
  ): Observable<ImpresoWithCost | undefined> {
    return this.open(ImpresoFormDialogComponent, { impreso }, 'md', {
      ariaLabel: impreso ? 'Editar impreso' : 'Nuevo impreso',
    });
  }

  openResetDatabase(): Observable<boolean | undefined> {
    return this.open(ResetDatabaseDialogComponent, {}, 'sm', {
      ariaLabel: 'Resetear base de datos',
    });
  }

  openConfirm(data: ConfirmDialogData): Observable<boolean> {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      ...formDialogConfig('sm'),
      ariaLabel: data.title,
      data,
    });
    return ref.closed as Observable<boolean>;
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
    const base = formDialogConfig(size);
    const ref = this.dialog.open(component, {
      ...base,
      panelClass: [...base.panelClass, ...(overrides.panelClass ?? [])],
      maxWidth: overrides.maxWidth ?? base.maxWidth,
      ariaLabel: overrides.ariaLabel,
      data,
    });
    return ref.closed as Observable<TResult | undefined>;
  }
}
