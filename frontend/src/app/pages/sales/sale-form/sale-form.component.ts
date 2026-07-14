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

  get isEditing(): boolean {
    return this.sale !== null;
  }

  get productOptions(): DbSelectOption[] {
    return this.products.map((product) => ({
      value: product.id,
      label: `${product.name} · ${this.formatPrice(product.price)}`,
    }));
  }

  get cartTotal(): number {
    return this.cart.reduce(
      (sum, line) => sum + line.quantity * line.unitPrice,
      0,
    );
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

    this.save.emit({
      items: this.cart.map((line) => ({
        productId: line.productId,
        productName: line.productName,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
      })),
      notes: this.notes.trim() || undefined,
      soldAt: this.isEditing ? this.sale!.soldAt : undefined,
    });
  }

  private resetForm(): void {
    this.pickerError = '';
    this.notes = '';
    this.pickQuantity = 1;
    this.productId = this.products[0]?.id ?? '';
    this.cart = [];

    if (this.sale) {
      this.notes = this.sale.notes ?? '';
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
