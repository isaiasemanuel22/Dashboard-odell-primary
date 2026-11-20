import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  Category,
  Product,
  ServiceProfitMargins,
  WholesaleDiscountSettings,
} from '../../core/models';
import { PRODUCT_TYPE_LABELS } from '../../shared/constants/labels';
import {
  CurrencyArsPipe,
  MediaUrlPipe,
} from '../../shared/pipes/labels.pipe';
import {
  productUsesPieceAssembly,
  resolveCategoryNamesText,
} from '../../shared/utils/product.helpers';
import {
  hasFixedCatalogPrice,
  totalMarginPercentRounded,
} from '../../shared/utils/product-margin.util';
import { resolveProfitArea } from '../../shared/utils/profit-area.util';
import {
  hasProductDiscount,
  productDiscountLabel,
  productSalePrice,
} from '../../shared/utils/product-discount.util';
import { productListStock } from '../../shared/utils/stock.helpers';
import {
  normalizeWholesaleDiscount,
  wholesalePriceFromList,
} from '../../shared/utils/wholesale-example.util';

@Component({
  selector: 'app-product-mobile-card',
  standalone: true,
  imports: [RouterLink, CurrencyArsPipe, MediaUrlPipe],
  templateUrl: './product-mobile-card.component.html',
  styleUrl: './product-mobile-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductMobileCardComponent {
  /** Espacio fino tipográfico antes del % (solo tarjeta mobile). */
  protected readonly thinSpace = '\u2009';
  /** Menos tipográfico U+2212 para márgenes negativos. */
  protected readonly minusSign = '\u2212';

  readonly product = input.required<Product>();
  readonly categories = input.required<Category[]>();
  readonly catalogProducts = input<Product[]>([]);
  /** Costo de mano de obra por hora (ajustes generales) para medir el margen sin MO. */
  readonly laborCostPerHour = input<number | null>(null);
  readonly profitMargins = input<ServiceProfitMargins | null>(null);
  readonly wholesaleDiscount = input<WholesaleDiscountSettings | null>(null);
  /** Sin uso en la tarjeta (muestra margen total); lo sigue pasando el listado. */
  readonly belowMargin = input<boolean | null>(null);

  protected readonly detailLink = computed(() => [
    '/productos',
    this.product().id,
  ]);

  protected readonly imageUrl = computed(() => {
    const images = this.product().images ?? [];
    return images.find((src) => !!src?.trim()) ?? null;
  });

  protected readonly hasFixedPrice = computed(() =>
    hasFixedCatalogPrice(this.product()),
  );

  protected readonly subtitle = computed(() => {
    const product = this.product();
    const typeLabel = PRODUCT_TYPE_LABELS[product.type] ?? product.type;
    const category =
      resolveCategoryNamesText(product.categoryIds, this.categories()) ||
      'Sin categoría';
    const parts = [typeLabel, category];

    if (productUsesPieceAssembly(product) && (product.components?.length ?? 0) > 0) {
      const count = product.components.length;
      parts.push(`${count} ${count === 1 ? 'pieza' : 'piezas'}`);
    } else {
      const stock = productListStock(product);
      if (stock > 0) parts.push(`Stock ${stock}`);
    }

    return parts.join(' · ');
  });

  protected readonly listPrice = computed(
    () => Number(this.product().price) || 0,
  );

  protected readonly hasDiscount = computed(() =>
    hasProductDiscount(this.product()),
  );

  /** Precio de venta (lista − descuento). Base del mayorista y del margen. */
  protected readonly salePrice = computed(
    () => Number(productSalePrice(this.product())) || 0,
  );

  protected readonly discountTag = computed(() =>
    productDiscountLabel(this.product()),
  );

  protected readonly wholesalePrice = computed((): number | null => {
    const product = this.product();
    const area = resolveProfitArea(product);
    const discount = normalizeWholesaleDiscount(this.wholesaleDiscount());
    if (
      !discount.enabled ||
      !area ||
      !discount.serviceTypes.includes(area)
    ) {
      return null;
    }
    return wholesalePriceFromList(
      this.salePrice(),
      discount.percent,
      product.cost,
    );
  });

  /** Margen total (§16.1.1): (precio de venta − costo total) ÷ costo total. */
  protected readonly totalMargin = computed(() =>
    totalMarginPercentRounded(this.salePrice(), this.product().cost),
  );

  /** «−28 %» / «45 %» con menos tipográfico si es negativo. */
  protected readonly markupLabel = computed(() => {
    const markup = this.totalMargin();
    if (markup == null) return '';
    const abs = Math.abs(markup);
    const prefix = markup < 0 ? this.minusSign : '';
    return `${prefix}${abs}${this.thinSpace}%`;
  });

  protected readonly accessibleName = computed(() => {
    const product = this.product();
    const list = new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0,
    }).format(this.salePrice());
    const margin = this.markupLabel();
    const parts = [
      product.name,
      this.subtitle(),
      `${this.hasDiscount() ? 'venta' : 'lista'} ${list}`,
    ];
    if (margin) parts.push(`margen total ${margin}`);
    return parts.join(', ');
  });

  /** Ganancia (> 0) → verde. */
  protected readonly isTotalMarginGain = computed(
    () => (this.totalMargin() ?? 0) > 0,
  );

  /** Pérdida (< 0) → rojo. Exactamente 0 queda neutro. */
  protected readonly isTotalMarginLoss = computed(
    () => (this.totalMargin() ?? 0) < 0,
  );

  /** Ancho de la barra: margen total entre 4 % y 100 % (pérdida = franja mínima). */
  protected readonly marginBarWidth = computed(() => {
    const margin = this.totalMargin();
    if (margin == null) return 0;
    return Math.max(4, Math.min(100, margin));
  });
}
