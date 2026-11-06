import {
  Component,
  EventEmitter,
  Injector,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  CreateRetailSalePayload,
  Order,
  PaymentMethod,
  Product,
  ProductStockOverview,
  RetailSale,
  TreasuryAccount,
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
  DbSegmentedControlComponent,
  DbSegmentOption,
} from '@general-components';
import { SaleFormCartComponent } from './sale-form-cart/sale-form-cart.component';
import { SaleCartLine } from '@general-components';
import { BreakpointService } from '../../../core/services/breakpoint.service';
import { SaleCartService } from '../../../core/services/sale-cart.service';
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
import { labelsToSelectOptions } from '../../../shared/utils/select-options';
import { defaultAccountForMethod } from '../../../shared/utils/treasury-account.util';
import { resolveMediaUrl } from '../../../shared/utils/media-url.util';
import { pluralize } from '../../../shared/utils/order.helpers';
import {
  PAYMENT_METHOD_LABELS,
  TREASURY_ACCOUNT_LABELS,
} from '../../../shared/utils/v1-labels.util';
import { CurrencyArsPipe } from '../../../shared/pipes/labels.pipe';
import { MobileDockAction } from '../../../components/mobile-dock/mobile-dock.component';
import { MobileFormShellComponent } from '../../../components/mobile-form-shell/mobile-form-shell.component';
import { MobileFormStepComponent } from '../../../components/mobile-form-step/mobile-form-step.component';
import { MobileStepperComponent } from '../../../components/mobile-stepper/mobile-stepper.component';

let cartLineKey = 0;

@Component({
  selector: 'app-sale-form',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    DbFormComponent,
    DbFieldsetComponent,
    DbFormGridComponent,
    DbSelectComponent,
    DbInputComponent,
    DbFormErrorComponent,
    DbTextareaComponent,
    DbFormFooterComponent,
    DbButtonComponent,
    DbSegmentedControlComponent,
    SaleFormCartComponent,
    CurrencyArsPipe,
    MobileFormShellComponent,
    MobileFormStepComponent,
    MobileStepperComponent,
  ],
  templateUrl: './sale-form.component.html',
  styleUrl: './sale-form.component.scss',
})
export class SaleFormComponent implements OnChanges {
  private readonly breakpoint = inject(BreakpointService);
  private readonly saleCart = inject(SaleCartService);
  private readonly injector = inject(Injector);
  private readonly router = inject(Router);

  @Input() sale: RetailSale | null = null;
  @Input() products: Product[] = [];
  @Input() stockByProductId: Record<string, ProductStockOverview> = {};
  @Input() loading = false;
  @Input() error = '';
  /** `auto` usa cards en mobile; `mobile` fuerza cards; `desktop` fuerza tabla. */
  @Input() layout: 'auto' | 'mobile' | 'desktop' = 'auto';
  /** Título de la barra mobile en ruta `/ventas/nueva`. Null = sin barra (modal). */
  @Input() mobileTitle: string | null = null;
  @Output() save = new EventEmitter<CreateRetailSalePayload>();
  @Output() cancel = new EventEmitter<void>();

  productId = '';
  pickQuantity = 1;
  productSearch = '';
  private editCart: SaleCartLine[] = [];
  notes = '';
  pickerError = '';
  discountMode: DiscountMode = 'none';
  discountPercent = 0;
  discountAmount = 0;
  method: PaymentMethod = PaymentMethod.EFECTIVO;
  account: TreasuryAccount = defaultAccountForMethod(PaymentMethod.EFECTIVO);
  /** Valor `YYYY-MM-DD` para el input date mobile. */
  soldAtLocal = '';

  readonly discountModeOptions: DbSelectOption[] = [
    { value: 'none', label: 'Sin descuento' },
    { value: 'percent', label: 'Porcentaje (%)' },
    { value: 'amount', label: 'Monto fijo ($)' },
  ];

  readonly discountSegmentOptions: DbSegmentOption<DiscountMode>[] = [
    { value: 'none', label: 'Sin' },
    { value: 'percent', label: '%' },
    { value: 'amount', label: '$' },
  ];

  readonly paymentMethodOptions: DbSegmentOption<PaymentMethod>[] =
    labelsToSelectOptions(PAYMENT_METHOD_LABELS);

  readonly accountOptions: DbSelectOption[] =
    labelsToSelectOptions(TREASURY_ACCOUNT_LABELS);

  get isEditing(): boolean {
    return this.sale !== null;
  }

  get showMobileSaleUi(): boolean {
    return this.breakpoint.isMobile();
  }

  get cart(): SaleCartLine[] {
    return this.isEditing ? this.editCart : this.saleCart.getLines();
  }

  get cartSectionTitle(): string {
    const count = this.cart.reduce((sum, line) => sum + line.quantity, 0);
    return `Carrito · ${pluralize(count, 'producto', 'productos')}`;
  }

  get productOptions(): DbSelectOption[] {
    return this.products.map((product) => ({
      value: product.id,
      label: `${product.name} · ${this.formatPrice(product.price)} · ${this.availableStock(product.id)} disp.`,
      disabled: this.availableStock(product.id) < 1,
    }));
  }

  get searchableProducts(): Product[] {
    const query = this.productSearch.trim().toLowerCase();
    if (!query) return [];
    return this.products
      .filter((product) => {
        if (product.published === false) return false;
        if (this.availableStock(product.id) < 1) return false;
        return product.name.toLowerCase().includes(query);
      })
      .slice(0, 8);
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

  get mobilePrimaryLabel(): string {
    if (this.loading) return 'Guardando...';
    if (this.isEditing) return 'Guardar cambios';
    return `Cobrar ${this.formatPrice(this.cartTotal)}`;
  }

  get mobileDockActions(): MobileDockAction[] {
    return [
      {
        id: 'close',
        label: this.mobilePrimaryLabel,
        kind: 'primary',
        disabled: !this.canCloseSale,
      },
    ];
  }

  onMobileDockAction(id: string): void {
    if (id === 'close') {
      this.closeSale();
    }
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

  onMethodChange(method: PaymentMethod): void {
    this.method = method;
    this.account = defaultAccountForMethod(method);
  }

  onProductChange(): void {
    this.pickerError =
      this.productId && this.availableStock(this.productId) < 1
        ? 'Este producto no tiene stock disponible. Creá un pedido para producirlo.'
        : '';
  }

  addProductFromSearch(product: Product): void {
    this.productId = product.id;
    this.pickQuantity = 1;
    this.addToCart();
    this.productSearch = '';
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
      if (!quantity || quantity <= 0) {
        this.editCart = this.editCart.filter((item) => item.key !== line.key);
        return;
      }
      line.quantity = quantity;
      return;
    }
    this.saleCart.updateLineQuantity(line.key, quantity);
  }

  bumpQuantity(line: SaleCartLine, delta: number): void {
    this.updateLineQuantity(line, line.quantity + delta);
  }

  lineImage(line: SaleCartLine): string | null {
    const product = this.products.find((item) => item.id === line.productId);
    const raw = product?.images?.find((src) => !!src?.trim()) ?? null;
    return resolveMediaUrl(raw);
  }

  closeSale(): void {
    if (!this.cart.length) return;

    const discount = discountPayloadFromMode(
      this.discountMode,
      this.discountPercent,
      this.discountAmount,
    );

    const soldAt = this.resolveSoldAtPayload();

    this.save.emit({
      items: this.cart.map((line) => ({
        productId: line.productId,
        productName: line.productName,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
      })),
      notes: this.notes.trim() || undefined,
      soldAt,
      discountPercent: discount.discountPercent,
      discountAmount: discount.discountAmount,
      method: this.method,
      account: this.account,
    });
  }

  createOrder(): void {
    if (!this.cart.length || this.isEditing) return;

    const presetCartLines = this.cart.map((line) => ({
      productId: line.productId,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
    }));

    // Import dinámico: evita ciclo SaleForm → FormDialogService → SaleFormDialog → SaleForm (ɵcmp).
    void import('../../../modals/form-dialog.service').then(
      ({ FormDialogService }) => {
        this.injector
          .get(FormDialogService)
          .openOrder(null, { presetCartLines })
          .subscribe((order: Order | undefined) => {
            if (!order) return;
            this.saleCart.clear();
            void this.router.navigate(['/pedidos', order.id]);
          });
      },
    );
  }

  cancelCart(): void {
    if (this.isEditing) {
      this.cancel.emit();
      return;
    }
    this.saleCart.clear();
    this.cancel.emit();
  }

  formatPrice(value: number): string {
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

  private resolveSoldAtPayload(): string | undefined {
    if (this.showMobileSaleUi && this.soldAtLocal) {
      const date = new Date(`${this.soldAtLocal}T12:00:00`);
      if (!Number.isNaN(date.getTime())) return date.toISOString();
    }
    if (this.isEditing) return this.sale!.soldAt;
    return undefined;
  }

  private toDateInputValue(value: string | Date | undefined | null): string {
    const fallback = new Date();
    const date = !value
      ? fallback
      : value instanceof Date
        ? value
        : new Date(value);
    const safe = Number.isNaN(date.getTime()) ? fallback : date;
    const month = String(safe.getMonth() + 1).padStart(2, '0');
    const day = String(safe.getDate()).padStart(2, '0');
    return `${safe.getFullYear()}-${month}-${day}`;
  }

  private todayInputValue(): string {
    return this.toDateInputValue(new Date());
  }

  private resetForm(): void {
    this.pickerError = '';
    this.productSearch = '';
    this.notes = '';
    this.pickQuantity = 1;
    this.productId =
      this.products.find((product) => this.availableStock(product.id) > 0)?.id ??
      '';
    this.editCart = [];
    this.discountMode = 'none';
    this.discountPercent = 0;
    this.discountAmount = 0;
    this.method = PaymentMethod.EFECTIVO;
    this.account = defaultAccountForMethod(PaymentMethod.EFECTIVO);
    this.soldAtLocal = this.todayInputValue();

    if (this.sale) {
      this.notes = this.sale.notes ?? '';
      this.discountMode = discountModeFromValues(
        this.sale.discountPercent,
        this.sale.discountAmount,
      );
      this.discountPercent = this.sale.discountPercent ?? 0;
      this.discountAmount = this.sale.discountAmount ?? 0;
      this.method = this.sale.method ?? PaymentMethod.EFECTIVO;
      this.account =
        this.sale.account ?? defaultAccountForMethod(this.method);
      this.soldAtLocal = this.toDateInputValue(this.sale.soldAt);
      this.editCart = this.sale.items.map((item) => ({
        key: `line-${++cartLineKey}`,
        productId: item.productId ?? '',
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      }));
    }
  }
}
