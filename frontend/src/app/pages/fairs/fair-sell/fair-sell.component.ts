import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { LayoutUiService } from '../../../layout/layout-ui.service';
import {
  CreateRetailSalePayload,
  FairDetail,
  PaymentMethod,
  Product,
} from '../../../core/models';
import { FairsService } from '../../../core/services/fairs.service';
import { ProductsService } from '../../../core/services/products.service';
import { SettingsService } from '../../../core/services/settings.service';
import { SalesService } from '../../../core/services/sales.service';
import { CurrencyArsPipe } from '../../../shared/pipes/labels.pipe';
import { extractApiErrorMessage } from '../../../shared/utils/api-error';
import { formatCurrencyArs } from '../../../shared/utils/currency-ars.util';
import {
  formatFairDateLong,
  formatFairTime,
} from '../../../shared/utils/fair.util';
import { defaultPaymentFee } from '../../../shared/utils/payment-fee.util';
import { productSalePrice } from '../../../shared/utils/product-discount.util';
import { matchesSearchText } from '../../../shared/utils/search-text.util';
import { productStockOverview } from '../../../shared/utils/stock.helpers';
import { defaultAccountForMethod } from '../../../shared/utils/treasury-account.util';

interface PayOption {
  value: PaymentMethod;
  label: string;
}

@Component({
  selector: 'app-fair-sell',
  standalone: true,
  imports: [RouterLink, FormsModule, CurrencyArsPipe],
  templateUrl: './fair-sell.component.html',
  styleUrl: './fair-sell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FairSellComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly fairsService = inject(FairsService);
  private readonly productsService = inject(ProductsService);
  private readonly salesService = inject(SalesService);
  private readonly settingsService = inject(SettingsService);
  private readonly layoutUi = inject(LayoutUiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly fairId = this.route.snapshot.paramMap.get('id') ?? '';
  readonly formatDateLong = formatFairDateLong;
  readonly formatTime = formatFairTime;

  readonly payOptions: PayOption[] = [
    { value: PaymentMethod.EFECTIVO, label: 'Efectivo' },
    { value: PaymentMethod.MERCADO_PAGO, label: 'QR MP' },
    { value: PaymentMethod.TRANSFERENCIA, label: 'Transf.' },
  ];

  readonly fair = signal<FairDetail | null>(null);
  readonly products = signal<Product[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal('');
  readonly search = signal('');
  readonly cart = signal<Record<string, number>>({});
  /** Unidades ya cobradas que el servidor todavía no reflejó en el stock local. */
  private readonly soldLocally = signal<Record<string, number>>({});
  readonly method = signal<PaymentMethod>(PaymentMethod.EFECTIVO);
  readonly paying = signal(false);
  readonly message = signal('');
  readonly error = signal('');

  readonly canSell = computed(() => this.fair()?.status === 'open');

  readonly visibleProducts = computed(() => {
    const term = this.search();
    const matches = this.products().filter(
      (p) => !term || matchesSearchText(p.name, term),
    );
    // Con stock primero; los «Sin stock» al final (el orden se mantiene).
    return [
      ...matches.filter((p) => this.stockOf(p) > 0),
      ...matches.filter((p) => this.stockOf(p) <= 0),
    ];
  });

  readonly units = computed(() =>
    Object.values(this.cart()).reduce((sum, qty) => sum + qty, 0),
  );

  readonly total = computed(() => {
    const cart = this.cart();
    return this.products().reduce(
      (sum, p) => sum + (cart[p.id] ?? 0) * productSalePrice(p),
      0,
    );
  });

  private readonly settings = toSignal(
    this.settingsService.watchGeneralSettings(),
    { initialValue: null },
  );
  /** Comisión escrita a mano; sin tocar, la de Mercado Pago por defecto (§28.1). */
  private readonly feeInput = signal<number | null>(null);
  private readonly feeTouched = signal(false);
  readonly fee = computed<number | null>(() => {
    if (this.feeTouched()) return this.feeInput();
    const fee = defaultPaymentFee(
      this.total(),
      this.method(),
      this.settings()?.integrations?.mercadoPago?.feePercent,
    );
    return fee > 0 ? fee : null;
  });

  readonly payLabel = computed(
    () => `Cobrar ${formatCurrencyArs(this.total())}`,
  );

  ngOnInit(): void {
    this.layoutUi.registerPageBar();
    this.destroyRef.onDestroy(() => this.layoutUi.unregisterPageBar());
    this.loadFair(true);
    this.loadProducts();
  }

  private loadFair(initial = false): void {
    this.fairsService.get(this.fairId).subscribe({
      next: (fair) => {
        this.fair.set(fair);
        this.loading.set(false);
      },
      error: (err) => {
        if (initial) {
          this.loadError.set(
            extractApiErrorMessage(err, 'No se pudo cargar la feria.'),
          );
          this.loading.set(false);
        }
      },
    });
  }

  private loadProducts(): void {
    this.productsService.getProducts().subscribe({
      next: (products) => {
        this.products.set(products);
        this.soldLocally.set({});
      },
      error: (err) =>
        this.error.set(
          extractApiErrorMessage(err, 'No se pudieron cargar los productos.'),
        ),
    });
  }

  /** «Martes 17/11»: el día con mayúscula inicial. */
  dayLabel(date: string): string {
    const text = formatFairDateLong(date);
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  stockOf(product: Product): number {
    const available = productStockOverview(
      product,
      product.stockOverview,
      this.products(),
    ).available;
    return Math.max(0, available - (this.soldLocally()[product.id] ?? 0));
  }

  qtyOf(product: Product): number {
    return this.cart()[product.id] ?? 0;
  }

  remaining(product: Product): number {
    return Math.max(0, this.stockOf(product) - this.qtyOf(product));
  }

  priceOf(product: Product): number {
    return productSalePrice(product);
  }

  add(product: Product): void {
    if (!this.canSell() || this.remaining(product) <= 0) return;
    this.message.set('');
    this.cart.update((cart) => ({
      ...cart,
      [product.id]: (cart[product.id] ?? 0) + 1,
    }));
  }

  subtract(product: Product): void {
    this.cart.update((cart) => {
      const next = { ...cart };
      const qty = (next[product.id] ?? 0) - 1;
      if (qty > 0) next[product.id] = qty;
      else delete next[product.id];
      return next;
    });
  }

  onFee(value: number | string | null): void {
    this.feeTouched.set(true);
    this.feeInput.set(value === null || value === '' ? null : Number(value));
  }

  onSearch(value: string): void {
    this.search.set(value);
  }

  charge(): void {
    if (!this.canSell() || this.paying() || this.units() === 0) return;
    const cart = this.cart();
    const items = this.products()
      .filter((p) => (cart[p.id] ?? 0) > 0)
      .map((p) => ({
        productId: p.id,
        quantity: cart[p.id],
        unitPrice: productSalePrice(p),
      }));
    const method = this.method();
    const payload: CreateRetailSalePayload = {
      items,
      method,
      account: defaultAccountForMethod(method),
      fairId: this.fairId,
      fee: Math.min(
        Math.max(0, Math.round(Number(this.fee()) || 0)),
        Math.max(0, this.total()),
      ),
    };
    const total = this.total();
    this.paying.set(true);
    this.error.set('');
    this.salesService.createRetailSale(payload).subscribe({
      next: () => {
        this.paying.set(false);
        // Se refleja ya mismo lo cobrado; después se pisa con lo que diga el servidor.
        this.soldLocally.update((sold) => {
          const next = { ...sold };
          for (const item of items) {
            next[item.productId] = (next[item.productId] ?? 0) + item.quantity;
          }
          return next;
        });
        this.fair.update((f) =>
          f
            ? {
                ...f,
                sold: Math.round((f.sold + total) * 100) / 100,
                salesCount: f.salesCount + 1,
              }
            : f,
        );
        this.cart.set({});
        this.feeInput.set(null);
        this.feeTouched.set(false);
        this.message.set(`Venta cobrada: ${formatCurrencyArs(total)}`);
        this.loadFair();
        this.loadProducts();
      },
      error: (err) => {
        this.paying.set(false);
        this.error.set(
          extractApiErrorMessage(err, 'No se pudo cobrar la venta.'),
        );
      },
    });
  }
}
