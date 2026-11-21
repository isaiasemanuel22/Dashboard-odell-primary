import { SettingsService } from '../../../core/services/settings.service';
import { defaultPaymentFee } from '../../../shared/utils/payment-fee.util';
import { productSalePrice } from '../../../shared/utils/product-discount.util';
import {
  Component,
  EventEmitter,
  HostListener,
  ElementRef,
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
import {
  MissingSummaryComponent,
  MissingSummaryItem,
} from '../../../components/missing-summary/missing-summary.component';
import { scrollToField } from '../../../shared/utils/form-missing.util';
import { LossSaleNoticeComponent } from '../../../components/loss-sale-notice/loss-sale-notice.component';
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
import {
  detectLossSale,
  lossSaleSignature,
} from '../../../shared/utils/loss-sale.util';
import {
  calculateCatalogLinesCost,
  getComponentLineCost,
} from '../../../shared/utils/product.helpers';
import {
  availableStockForSaleEdit,
  canCloseRetailSale,
  productStockOverview,
  quantityCommittedInSale,
} from '../../../shared/utils/stock.helpers';
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
import {
  MobileChipGroupComponent,
  MobileChipOption,
} from '../../../components/mobile-chip-group/mobile-chip-group.component';
import { MobileFormShellComponent } from '../../../components/mobile-form-shell/mobile-form-shell.component';
import { confirmMobileFormDiscard } from '../../../components/mobile-form-shell/confirm-mobile-form-discard';
import { MobileFormStepComponent } from '../../../components/mobile-form-step/mobile-form-step.component';
import { MobileStepperComponent } from '../../../components/mobile-stepper/mobile-stepper.component';
import { MobileSheetComponent } from '../../../components/mobile-sheet/mobile-sheet.component';
import { FormDialogService } from '../../../modals/form-dialog.service';

let cartLineKey = 0;
import { normalizeSearchText } from '../../../shared/utils/search-text.util';

@Component({
  selector: 'app-sale-form',
  standalone: true,
  imports: [
    MissingSummaryComponent,
    LossSaleNoticeComponent,
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
    MobileChipGroupComponent,
    MobileSheetComponent,
  ],
  templateUrl: './sale-form.component.html',
  styleUrl: './sale-form.component.scss',
})
export class SaleFormComponent implements OnChanges {
  private readonly breakpoint = inject(BreakpointService);
  private readonly saleCart = inject(SaleCartService);
  private readonly formDialogs = inject(FormDialogService);
  private readonly injector = inject(Injector);
  private readonly router = inject(Router);
  private readonly settingsService = inject(SettingsService);
  private readonly hostRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private confirmingDiscard = false;

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
  /** Pedido de eliminar venta (solo edición); el padre confirma y llama al servicio. */
  @Output() deleteRequest = new EventEmitter<void>();

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
  /** Comisión escrita a mano; null y sin tocar = la de Mercado Pago por defecto. */
  private feeInput: number | null = null;
  private feeTouched = false;
  account: TreasuryAccount = defaultAccountForMethod(PaymentMethod.EFECTIVO);
  /** Valor `YYYY-MM-DD` para el input date mobile. */
  soldAtLocal = '';
  mobileActionsOpen = false;

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

  readonly paymentChipOptions: MobileChipOption<PaymentMethod>[] =
    labelsToSelectOptions(PAYMENT_METHOD_LABELS);

  readonly accountOptions: DbSelectOption[] =
    labelsToSelectOptions(TREASURY_ACCOUNT_LABELS);

  get isEditing(): boolean {
    return this.sale !== null;
  }

  get showMobileSaleUi(): boolean {
    return this.breakpoint.isMobile();
  }

  /** Modal de escritorio (RdVentaMostrador); la ruta `/ventas/nueva` fuerza `layout="mobile"`. */
  get showModalLayout(): boolean {
    return !this.showMobileSaleUi && this.layout === 'auto';
  }

  readonly stockForFn = (productId: string): number =>
    this.availableStock(productId);

  readonly imageForFn = (line: SaleCartLine): string | null =>
    this.lineImage(line);

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
      label: `${product.name} · ${this.formatPrice(productSalePrice(product))} · ${this.availableStock(product.id)} disp.`,
      disabled: this.availableStock(product.id) < 1,
    }));
  }

  get searchableProducts(): Product[] {
    const query = normalizeSearchText(this.productSearch);
    if (!query) return [];
    return this.products
      .filter((product) => {
        if (product.published === false) return false;
        if (this.availableStock(product.id) < 1) return false;
        return normalizeSearchText(product.name).includes(query);
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

  /** Comisión del cobro: precargada con la de Mercado Pago mientras no se toque (§29.1). */
  get feeValue(): number | null {
    if (this.feeTouched) return this.feeInput;
    const fee = defaultPaymentFee(
      this.cartTotal,
      this.method,
      this.settingsService.peekGeneralSettings()?.integrations?.mercadoPago
        ?.feePercent,
    );
    return fee > 0 ? fee : null;
  }

  onFeeInput(value: number | string | null): void {
    this.feeTouched = true;
    this.feeInput = value === null || value === '' ? null : Number(value);
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

  /** Qué falta para cobrar (vacío si se puede). Cada ítem lleva al carrito. */
  get closeSaleMissingItems(): MissingSummaryItem[] {
    if (this.loading || this.canCloseSale) return [];
    if (!this.cart.length) {
      return [{ label: 'productos en el carrito', key: 'cart' }];
    }
    return this.cart
      .filter((line) => line.quantity > this.availableStock(line.productId))
      .map((line) => ({
        label: `stock suficiente de ${line.productName}`,
        key: `stock:${line.productId}`,
      }));
  }

  /** Lleva la vista al carrito y enfoca el primer campo editable. */
  goToMissing(item: MissingSummaryItem): void {
    const root = this.hostRef.nativeElement;
    scrollToField(root, 'app-sale-form-cart, db-select', { highlight: true });
  }

  stockLimitNotice = '';
  private stockNoticeTimer: ReturnType<typeof setTimeout> | null = null;

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
    const actions: MobileDockAction[] = [];
    // Modal (sin barra ⋯): misma acción «Crear pedido» que el pie desktop.
    if (!this.mobileTitle && this.showMobileCreateOrderAction) {
      actions.push({
        id: 'order',
        label: 'Crear pedido',
        kind: 'secondary',
        disabled: !this.hasCartItems,
      });
    }
    actions.push({
      id: 'close',
      label: this.mobilePrimaryLabel,
      kind: 'primary',
      disabled: !this.canCloseSale,
    });
    return actions;
  }

  /** Menú ⋯ en ruta mobile (nueva/editar); no en modal embebido. */
  get showMobileActionsMenu(): boolean {
    return this.showMobileSaleUi && !!this.mobileTitle;
  }

  get showMobileCreateOrderAction(): boolean {
    return !this.isEditing;
  }

  get showMobileDeleteAction(): boolean {
    return this.isEditing;
  }

  onMobileDockAction(id: string): void {
    if (id === 'order') {
      this.createOrder();
      return;
    }
    if (id === 'close') {
      this.closeSale();
    }
  }

  openMobileActions(): void {
    this.mobileActionsOpen = true;
  }

  closeMobileActions(): void {
    if (!this.mobileActionsOpen) return;
    this.mobileActionsOpen = false;
  }

  onMobileCreateOrder(): void {
    this.closeMobileActions();
    this.createOrder();
  }

  onMobileDelete(): void {
    this.closeMobileActions();
    this.deleteRequest.emit();
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    this.closeMobileActions();
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

  onPaymentChipChange(method: PaymentMethod | null): void {
    if (method == null) return;
    this.onMethodChange(method);
  }

  hasUnsavedChanges(): boolean {
    return this.cart.length > 0 || !!this.notes.trim() || this.discountMode !== 'none';
  }

  requestCancel(): void {
    if (this.confirmingDiscard) return;
    this.confirmingDiscard = true;
    confirmMobileFormDiscard(this.formDialogs, {
      hasChanges: this.hasUnsavedChanges(),
      entityLabel: 'la venta',
    }).subscribe((confirmed) => {
      this.confirmingDiscard = false;
      if (confirmed) this.cancel.emit();
    });
  }

  onStockMaxReached(): void {
    this.stockLimitNotice = 'No hay más stock';
    if (this.stockNoticeTimer) clearTimeout(this.stockNoticeTimer);
    this.stockNoticeTimer = setTimeout(() => {
      this.stockLimitNotice = '';
      this.stockNoticeTimer = null;
    }, 2200);
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
          unitPrice: productSalePrice(product),
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

    // Venta a pérdida: el vendedor confirma y da un motivo (§16).
    const loss = detectLossSale(
      this.cart.map((line) => ({
        productName: line.productName,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        unitCost:
          getComponentLineCost(this.products, line.productId, line.quantity) /
          Math.max(1, Number(line.quantity) || 1),
      })),
      this.cartTotal,
    );
    if (!loss.isLoss) {
      this.emitSale();
      return;
    }
    const sameLossSet =
      !!this.sale?.lossReason &&
      lossSaleSignature(
        detectLossSale(
          this.sale.items.map((item) => ({
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            unitCost:
              item.productId
                ? getComponentLineCost(this.products, item.productId, 1)
                : 0,
          })),
          this.sale.total,
        ),
      ) === lossSaleSignature(loss);
    if (sameLossSet && this.sale) {
      this.emitSale({
        lossReason: this.sale.lossReason!,
        lossReasonNote: this.sale.lossReasonNote,
      });
      return;
    }
    this.formDialogs
      .openLossSale({
        lines: loss.lines,
        profit: loss.profit,
        profitNegative: loss.profitNegative,
        lossReason: this.sale?.lossReason,
        lossReasonNote: this.sale?.lossReasonNote,
      })
      .subscribe((result) => {
        if (result) this.emitSale(result);
      });
  }

  private emitSale(lossFields?: {
    lossReason: string;
    lossReasonNote?: string;
  }): void {
    const discount = discountPayloadFromMode(
      this.discountMode,
      this.discountPercent,
      this.discountAmount,
    );
    const soldAt = this.resolveSoldAtPayload();

    this.save.emit({
      ...(lossFields
        ? {
            lossReason: lossFields.lossReason,
            ...(lossFields.lossReasonNote
              ? { lossReasonNote: lossFields.lossReasonNote }
              : {}),
          }
        : {}),
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
      fee: Math.min(
        Math.max(0, Math.round(Number(this.feeValue) || 0)),
        Math.max(0, this.cartTotal),
      ),
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

  readonly salePrice = productSalePrice;

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
    const current = product
      ? productStockOverview(product, overview, this.products).available
      : Math.max(0, Math.trunc(Number(overview?.available) || 0));
    // Al editar, devolver las unidades que esta venta ya descontó.
    return availableStockForSaleEdit(
      current,
      quantityCommittedInSale(this.sale, productId),
    );
  }

  private resolveSoldAtPayload(): string | undefined {
    if (this.showMobileSaleUi && this.soldAtLocal) {
      const date = new Date(`${this.soldAtLocal}T12:00:00`);
      if (!Number.isNaN(date.getTime())) return date.toISOString();
    }
    if (this.showModalLayout && this.soldAtLocal) {
      // Solo se manda la fecha si la cambiaron: así se conserva la hora original.
      const original = this.isEditing
        ? this.toDateInputValue(this.sale!.soldAt)
        : this.todayInputValue();
      if (this.soldAtLocal !== original) {
        const date = new Date(`${this.soldAtLocal}T12:00:00`);
        if (!Number.isNaN(date.getTime())) return date.toISOString();
      }
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
    this.feeInput = null;
    this.feeTouched = false;
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
      this.feeInput = this.sale.fee > 0 ? this.sale.fee : null;
      this.feeTouched = true;
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
