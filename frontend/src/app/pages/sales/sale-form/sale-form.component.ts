import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  CreateRetailSalePayload,
  Product,
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
} from '@general-components';
import { CurrencyArsPipe } from '../../../shared/pipes/labels.pipe';
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
    CurrencyArsPipe,
  ],
  templateUrl: './sale-form.component.html',
  styleUrl: './sale-form.component.scss',
})
export class SaleFormComponent implements OnChanges {
  @Input() sale: RetailSale | null = null;
  @Input() products: Product[] = [];
  @Input() loading = false;
  @Input() error = '';
  @Output() save = new EventEmitter<CreateRetailSalePayload>();
  @Output() cancel = new EventEmitter<void>();

  productId = '';
  pickQuantity = 1;
  cart: SaleCartLine[] = [];
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

  get productOptions(): DbSelectOption[] {
    return this.products.map((product) => ({
      value: product.id,
      label: `${product.name} · ${this.formatPrice(product.price)}`,
    }));
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

  get canCloseSale(): boolean {
    return this.cart.length > 0 && !this.loading;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['sale'] || changes['products']) {
      this.resetForm();
    }
  }

  onProductChange(): void {
    this.pickerError = '';
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
    if (existing) {
      existing.quantity += quantity;
    } else {
      this.cart.push({
        key: `line-${++cartLineKey}`,
        productId: product.id,
        productName: product.name,
        quantity,
        unitPrice: product.price,
      });
    }

    this.pickQuantity = 1;
  }

  removeFromCart(key: string): void {
    this.cart = this.cart.filter((line) => line.key !== key);
  }

  updateLineQuantity(line: SaleCartLine, quantity: number): void {
    line.quantity = quantity;
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

  private resetForm(): void {
    this.pickerError = '';
    this.notes = '';
    this.pickQuantity = 1;
    this.productId = this.products[0]?.id ?? '';
    this.cart = [];
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
      this.cart = this.sale.items.map((item) => ({
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
}
