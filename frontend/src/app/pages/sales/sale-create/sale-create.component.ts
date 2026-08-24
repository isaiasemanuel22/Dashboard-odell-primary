import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  CreateRetailSalePayload,
  Product,
  ProductStockOverview,
  RetailSale,
  UpdateRetailSalePayload,
} from '../../../core/models';
import { ProductsService } from '../../../core/services/products.service';
import { SalesService } from '../../../core/services/sales.service';
import { SaleCartService } from '../../../core/services/sale-cart.service';
import { SaleFormComponent } from '../sale-form/sale-form.component';
import { extractApiErrorMessage } from '../../../shared/utils/api-error';
import { productStockOverview } from '../../../shared/utils/stock.helpers';

@Component({
  selector: 'app-sale-create',
  standalone: true,
  imports: [RouterLink, SaleFormComponent],
  templateUrl: './sale-create.component.html',
  styleUrl: './sale-create.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SaleCreateComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly salesService = inject(SalesService);
  private readonly productsService = inject(ProductsService);
  private readonly saleCart = inject(SaleCartService);
  private readonly cdr = inject(ChangeDetectorRef);

  sale: RetailSale | null = null;
  products: Product[] = [];
  stockByProductId: Record<string, ProductStockOverview> = {};
  loading = false;
  loadingSale = false;
  error = '';

  ngOnInit(): void {
    this.loadProducts();

    const saleId = this.route.snapshot.paramMap.get('id');
    if (saleId) {
      this.loadingSale = true;
      this.cdr.markForCheck();
      this.salesService.getRetailSale(saleId).subscribe({
        next: (sale) => {
          this.sale = sale;
          this.loadingSale = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.loadingSale = false;
          this.error = extractApiErrorMessage(err, 'No se pudo cargar la venta');
          this.cdr.markForCheck();
        },
      });
    }
  }

  get title(): string {
    return this.sale ? 'Editar venta' : 'Nueva venta';
  }

  save(data: CreateRetailSalePayload): void {
    this.loading = true;
    this.error = '';
    this.cdr.markForCheck();

    const request = this.sale
      ? this.salesService.updateRetailSale(
          this.sale.id,
          data as UpdateRetailSalePayload,
        )
      : this.salesService.createRetailSale(data);

    request.subscribe({
      next: () => {
        this.loading = false;
        if (!this.sale) {
          this.saleCart.clear();
        }
        void this.router.navigate(['/ventas']);
      },
      error: (err) => {
        this.loading = false;
        this.error = extractApiErrorMessage(err, 'Error al cerrar la venta');
        this.cdr.markForCheck();
      },
    });
  }

  cancel(): void {
    void this.router.navigate(['/ventas']);
  }

  private loadProducts(): void {
    this.productsService.getProducts(undefined, { all: true }).subscribe({
      next: (products) => {
        this.products = products;
        this.stockByProductId = Object.fromEntries(
          products.map((product) => [
            product.id,
            productStockOverview(product),
          ]),
        );
        this.cdr.markForCheck();
      },
    });
  }
}
