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
  RetailSale,
  Supply,
} from '../../core/models';
import { formDialogConfig } from './form-dialog.config';
import { ModalSize } from './modal-size';
import { CategoryFormDialogComponent } from './category-form-dialog.component';
import { CustomerFormDialogComponent } from './customer-form-dialog.component';
import { ImpresoFormDialogComponent } from './impreso-form-dialog.component';
import { OrderFormDialogComponent } from './order-form-dialog.component';
import { ProductFormDialogComponent } from './product-form-dialog.component';
import { ResetDatabaseDialogComponent } from './reset-database-dialog.component';
import { SaleFormDialogComponent } from './sale-form-dialog.component';
import { SupplyFormDialogComponent } from './supply-form-dialog.component';

@Injectable({ providedIn: 'root' })
export class FormDialogService {
  private readonly dialog = inject(Dialog);

  openCustomer(customer: Customer | null = null): Observable<Customer | undefined> {
    return this.open(CustomerFormDialogComponent, { customer }, 'sm', {
      ariaLabel: customer ? 'Editar cliente' : 'Nuevo cliente',
    });
  }

  openOrder(order: Order | null = null): Observable<Order | undefined> {
    return this.open(OrderFormDialogComponent, { order }, 'lg', {
      ariaLabel: order ? 'Editar pedido' : 'Nuevo pedido',
    });
  }

  openProduct(product: Product | null = null): Observable<Product | undefined> {
    return this.open(ProductFormDialogComponent, { product }, 'lg', {
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

  openSupply(supply: Supply | null = null): Observable<Supply | undefined> {
    return this.open(SupplyFormDialogComponent, { supply }, 'md', {
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

  private open<TData, TResult>(
    component: Type<unknown>,
    data: TData,
    size: ModalSize,
    overrides: { ariaLabel: string },
  ): Observable<TResult | undefined> {
    const ref = this.dialog.open(component, {
      ...formDialogConfig(size),
      ariaLabel: overrides.ariaLabel,
      data,
    });
    return ref.closed as Observable<TResult | undefined>;
  }
}
