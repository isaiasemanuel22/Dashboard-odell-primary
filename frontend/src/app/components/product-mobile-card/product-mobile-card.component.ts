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
  markupPercentOnCostRounded,
} from '../../shared/utils/product-margin.util';
import { getMarginForProductType } from '../../shared/utils/pricing.util';
import { resolveProfitArea } from '../../shared/utils/profit-area.util';
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
  readonly profitMargins = input<ServiceProfitMargins | null>(null);
  readonly wholesaleDiscount = input<WholesaleDiscountSettings | null>(null);
  /** Mismo criterio que el chip «Bajo margen» (alertas del backend); null = calcular. */
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
    return wholesalePriceFromList(this.listPrice(), discount.percent);
  });

  protected readonly markupPercent = computed(() =>
    markupPercentOnCostRounded(this.listPrice(), this.product().cost),
  );

  /** «−28 %» / «45 %» con menos tipográfico si es negativo. */
  protected readonly markupLabel = computed(() => {
    const markup = this.markupPercent();
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
    }).format(this.listPrice());
    const margin = this.markupLabel();
    const parts = [product.name, this.subtitle(), `lista ${list}`];
    if (margin) parts.push(`margen ${margin}`);
    return parts.join(', ');
  });

  protected readonly targetMarginPercent = computed(() => {
    const margins = this.profitMargins();
    if (!margins) return 0;
    return getMarginForProductType(this.product().type, margins);
  });

  protected readonly meetsTargetMargin = computed(() => {
    const below = this.belowMargin();
    if (below !== null) return !below;
    const markup = this.markupPercent();
    if (markup == null) return true;
    return markup >= this.targetMarginPercent();
  });

  /**
   * Ancho relativo al margen objetivo, entre 4 % y 100 %: con margen negativo
   * o nulo queda una franja roja mínima en vez de una barra vacía o llena.
   */
  protected readonly marginBarWidth = computed(() => {
    const markup = this.markupPercent();
    const target = this.targetMarginPercent();
    if (markup == null || target <= 0) return 0;
    return Math.max(4, Math.min(100, (markup / target) * 100));
  });
}
