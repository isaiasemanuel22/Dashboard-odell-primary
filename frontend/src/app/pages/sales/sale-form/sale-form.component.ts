import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  CreateRetailSalePayload,
  Product,
  ProductStockOverview,
  RetailSale,
} from '../../../core/models';
import {
  DbFieldsetComponent,
  DbFormComponent,
  DbFormErrorComponent,
  DbFormFooterComponent,
  DbFormGridComponent,
  DbInputComponent,
  DbSelectComponent,
  DbTextareaComponent,
  DbButtonComponent,
  SaleCartLine,
  SaleCartLineComponent,
  SaleCartLineCardComponent,
} from '@general-components';
import { BreakpointService } from '../../../core/services/breakpoint.service';
import { SaleCartService } from '../../../core/services/sale-cart.service';
import { Router } from '@angular/router';
import { CurrencyArsPipe } from '../../../shared/pipes/labels.pipe';
import { FormDialogService } from '../../../shared/form-dialogs/public-api';
import { DbSelectOption } from '../../../components/dashboard-form/db-select/db-select.types';
import {
  DiscountMode,
  calculateDiscountValue,
  calculateItemsSubtotal,
  calculateTotalWithDiscount,
  discountModeFromValues,
  discountPayloadFromMode,
} from '../../../shared/utils/discount.util';
import { calculateCatalogLinesCost } from '../../../shared/utils/product.helpers';
import { productStockOverview, canCloseRetailSale } from '../../../shared/utils/stock.helpers';

let cartLineKey = 0;

@Component({
  selector: 'app-sale-form',
  standalone: true,
  imports: [
    FormsModule,
    DbFormComponent,
    DbFieldsetComponent,
    DbFormGridComponent,
    DbSelectComponent,
    DbInputComponent,
    DbFormErrorComponent,
    DbTextareaComponent,
    DbFormFooterComponent,
    DbButtonComponent,
    SaleCartLineComponent,
    SaleCartLineCardComponent,
    CurrencyArsPipe,
  ],
  templateUrl: './sale-form.component.html',
  styleUrl: './sale-form.component.scss',
})
export class SaleFormComponent implements OnChanges {
  private readonly breakpoint = inject(BreakpointService);
  private readonly saleCart = inject(SaleCartService);
  private readonly formDialogs = inject(FormDialogService);
  private readonly router = inject(Router);

  @Input() sale: RetailSale | null = null;
  @Input() products: Product[] = [];
  @Input() stockByProductId: Record<string, ProductStockOverview> = {};
  @Input() loading = false;
  @Input() error = '';
  /** `auto` usa cards en mobile; `mobile` fuerza cards; `desktop` fuerza tabla. */
  @Input() layout: 'auto' | 'mobile' | 'desktop' = 'auto';
  @Output() save = new EventEmitter<CreateRetailSalePayload>();
  @Output() cancel = new EventEmitter<void>();

  productId = '';
  pickQuantity = 1;
  private editCart: SaleCartLine[] = [];
  notes = '';
  pickerError = '';
  discountMode: DiscountMode = 'none';
  discountPercent = 0;
  discountAmount = 0;

  readonly discountModeOptions: DbSelectOption[] = [
    { value: 'none', label: 'Sin descuento' },
    { value: 'percent', label: 'Porcentaje (%)' },
    { value: 'amount', label: 'Monto fijo ($)' },
  ];

  get isEditing(): boolean {
    return this.sale !== null;
  }

  get cart(): SaleCartLine[] {
    return this.isEditing ? this.editCart : this.saleCart.getLines();
  }

  get productOptions(): DbSelectOption[] {
    return this.products.map((product) => ({
      value: product.id,
      label: `${product.name} · ${this.formatPrice(product.price)} · ${this.availableStock(product.id)} disp.`,
      disabled: this.availableStock(product.id) < 1,
    }));
  }

  get hasAvailableProducts(): boolean {
    return this.products.some((product) => this.availableStock(product.id) > 0);
  }

  get cartSubtotal(): number {
    return calculateItemsSubtotal(this.cart);
  }

  get cartDiscount(): number {
    const discount = discountPayloadFromMode(
      this.discountMode,
      this.discountPercent,
      this.discountAmount,
    );
    return calculateDiscountValue(
      this.cartSubtotal,
      discount.discountPercent,
      discount.discountAmount,
    );
  }

  get cartTotal(): number {
    const discount = discountPayloadFromMode(
      this.discountMode,
      this.discountPercent,
      this.discountAmount,
    );
    return calculateTotalWithDiscount(
      this.cartSubtotal,
      discount.discountPercent,
      discount.discountAmount,
    );
  }

  get hasDiscount(): boolean {
    return this.discountMode !== 'none';
  }

  get cartCost(): number {
    return calculateCatalogLinesCost(this.cart, this.products);
  }

  get cartProfit(): number {
    return this.cartTotal - this.cartCost;
  }

  get closeSaleBlockReason(): string | null {
    if (!this.cart.length || this.canCloseSale || this.loading) return null;
    const names = this.cart
      .filter((line) => line.quantity > this.availableStock(line.productId))
      .map((line) => line.productName);
    if (!names.length) return null;
    return `No se puede cerrar la venta: ${names.join(', ')} no tiene stock suficiente. Creá un pedido para producirlo.`;
  }

  get canCloseSale(): boolean {
    return (
      !this.loading &&
      canCloseRetailSale(this.cart, (productId) =>
        this.availableStock(productId),
      )
    );
  }

  get hasCartItems(): boolean {
    return this.cart.length > 0 && !this.loading;
  }

  get useCardLayout(): boolean {
    if (this.layout === 'mobile') return true;
    if (this.layout === 'desktop') return false;
    return this.breakpoint.isMobile();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['sale'] || changes['products']) {
      this.resetForm();
    } else if (changes['stockByProductId'] && !this.productId) {
      this.productId =
        this.products.find((product) => this.availableStock(product.id) > 0)
          ?.id ?? '';
    }
  }

  onProductChange(): void {
    this.pickerError =
      this.productId && this.availableStock(this.productId) < 1
        ? 'Este producto no tiene stock disponible. Creá un pedido para producirlo.'
        : '';
  }

  addToCart(): void {
    this.pickerError = '';

    const product = this.products.find((item) => item.id === this.productId);
    if (!product) {
      this.pickerError = 'Seleccioná un producto del catálogo';
      return;
    }

    const quantity = Number(this.pickQuantity);
    if (!quantity || quantity <= 0) {
      this.pickerError = 'La cantidad debe ser mayor a cero';
      return;
    }

    const existing = this.cart.find((line) => line.productId === product.id);

    if (this.isEditing) {
      if (existing) {
        existing.quantity += quantity;
      } else {
        this.editCart.push({
          key: `line-${++cartLineKey}`,
          productId: product.id,
          productName: product.name,
          quantity,
          unitPrice: product.price,
        });
      }
    } else {
      const result = this.saleCart.addProduct(product, quantity);
      if (!result.ok) {
        this.pickerError = result.error ?? 'No se pudo agregar al carrito';
        return;
      }
    }

    this.pickQuantity = 1;
  }

  removeFromCart(key: string): void {
    if (this.isEditing) {
      this.editCart = this.editCart.filter((line) => line.key !== key);
      return;
    }
    this.saleCart.removeLine(key);
  }

  updateLineQuantity(line: SaleCartLine, quantity: number): void {
    if (this.isEditing) {
      line.quantity = quantity;
      return;
    }
    this.saleCart.updateLineQuantity(line.key, quantity);
  }

  closeSale(): void {
    if (!this.cart.length) return;

    const discount = discountPayloadFromMode(
      this.discountMode,
      this.discountPercent,
      this.discountAmount,
    );

    this.save.emit({
      items: this.cart.map((line) => ({
        productId: line.productId,
        productName: line.productName,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
      })),
      notes: this.notes.trim() || undefined,
      soldAt: this.isEditing ? this.sale!.soldAt : undefined,
      discountPercent: discount.discountPercent,
      discountAmount: discount.discountAmount,
    });
  }

  createOrder(): void {
    if (!this.cart.length || this.isEditing) return;

    this.formDialogs
      .openOrder(null, {
        presetCartLines: this.cart.map((line) => ({
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

  cancelCart(): void {
    if (this.isEditing) {
      this.cancel.emit();
      return;
    }
    this.saleCart.clear();
    this.cancel.emit();
  }

  private resetForm(): void {
    this.pickerError = '';
    this.notes = '';
    this.pickQuantity = 1;
    this.productId =
      this.products.find((product) => this.availableStock(product.id) > 0)?.id ??
      '';
    this.editCart = [];
    this.discountMode = 'none';
    this.discountPercent = 0;
    this.discountAmount = 0;

    if (this.sale) {
      this.notes = this.sale.notes ?? '';
      this.discountMode = discountModeFromValues(
        this.sale.discountPercent,
        this.sale.discountAmount,
      );
      this.discountPercent = this.sale.discountPercent ?? 0;
      this.discountAmount = this.sale.discountAmount ?? 0;
      this.editCart = this.sale.items.map((item) => ({
        key: `line-${++cartLineKey}`,
        productId: item.productId ?? '',
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      }));
    }
  }

  private formatPrice(value: number): string {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0,
    }).format(value);
  }

  availableStock(productId: string): number {
    const product = this.products.find((item) => item.id === productId);
    const overview = this.stockByProductId[productId];
    if (product) {
      return productStockOverview(product, overview, this.products).available;
    }
    return Math.max(0, Math.trunc(Number(overview?.available) || 0));
  }
}
