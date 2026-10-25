import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AsyncPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { combineLatest } from 'rxjs';
import { Product } from '../../core/models';
import type { SaleCartLine } from '../sale-cart-line/sale-cart-line.types';
import { DbButtonComponent } from '../db-button/db-button.component';
import { CurrencyArsPipe } from '../../shared/pipes/labels.pipe';
import { SaleCartService } from '../../core/services/sale-cart.service';
import { CatalogFacade } from '../../store/catalog/catalog.facade';
import { calculateItemsSubtotal } from '../../shared/utils/discount.util';
import {
  canCloseRetailSale,
  productStockOverview,
} from '../../shared/utils/stock.helpers';
import { FormDialogService } from '../../shared/form-dialogs/public-api';

@Component({
  selector: 'app-sale-cart-footer',
  standalone: true,
  imports: [AsyncPipe, RouterLink, DbButtonComponent, CurrencyArsPipe],
  templateUrl: './sale-cart-footer.component.html',
  styleUrl: './sale-cart-footer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SaleCartFooterComponent implements OnInit {
  private readonly saleCart = inject(SaleCartService);
  private readonly catalog = inject(CatalogFacade);
  private readonly formDialogs = inject(FormDialogService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly lines$ = this.saleCart.lines$;
  products: Product[] = [];

  ngOnInit(): void {
    this.catalog.loadAllProducts(true);

    combineLatest([this.saleCart.lines$, this.catalog.allProducts$])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([, products]) => {
        this.products = products;
        this.cdr.markForCheck();
      });
  }

  subtotal(lines: SaleCartLine[]): number {
    return calculateItemsSubtotal(lines);
  }

  lineTotal(line: SaleCartLine): number {
    return line.quantity * line.unitPrice;
  }

  canCloseSale(lines: SaleCartLine[]): boolean {
    return canCloseRetailSale(lines, (productId) =>
      this.availableStock(productId),
    );
  }

  closeSaleBlockReason(lines: SaleCartLine[]): string | null {
    if (!lines.length || this.canCloseSale(lines)) return null;
    const names = lines
      .filter((line) => line.quantity > this.availableStock(line.productId))
      .map((line) => line.productName);
    if (!names.length) return null;
    return `No se puede cerrar la venta: ${names.join(', ')} no tiene stock suficiente. Creá un pedido para producirlo.`;
  }

  removeLine(key: string): void {
    this.saleCart.removeLine(key);
  }

  cancelCart(): void {
    this.saleCart.clear();
  }

  createOrder(lines: SaleCartLine[]): void {
    if (!lines.length) return;

    this.formDialogs
      .openOrder(null, {
        presetCartLines: lines.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
        })),
      })
      .subscribe((order) => {
        if (!order) return;
        this.saleCart.clear();
        void this.router.navigate(['/pedidos', order.id]);
      });
  }

  private availableStock(productId: string): number {
    const product = this.products.find((item) => item.id === productId);
    return product
      ? productStockOverview(product, undefined, this.products).available
      : 0;
  }
}
