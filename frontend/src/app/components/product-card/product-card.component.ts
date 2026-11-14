import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  Product,
  ProductEstampado,
  ProductType,
  ServiceProfitMargins,
  WholesaleDiscountSettings,
  isProduct3D,
} from '../../core/models';
import { Category } from '../../core/models';
import { PAPER_TYPE_LABELS } from '../../shared/constants/labels';
import {
  CurrencyArsPipe,
  DateShortPipe,
  ProductTypeLabelPipe,
} from '../../shared/pipes/labels.pipe';
import {
  formatPrintDimensionsCm,
  hasValidPrintSize,
} from '../../shared/utils/estampado.helpers';
import {
  productUsesPieceAssembly,
  resolveCategoryNamesText,
  resolveProductUnitPrice,
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
import { ProductImageCarouselComponent } from '../product-image-carousel/product-image-carousel.component';
import { DbRowMenuComponent } from '../db-row-menu/db-row-menu.component';

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [
    RouterLink,
    CurrencyArsPipe,
    DateShortPipe,
    ProductTypeLabelPipe,
    ProductImageCarouselComponent,
    DbRowMenuComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-card.component.html',
  styleUrl: './product-card.component.scss',
})
export class ProductCardComponent {
  @Input({ required: true }) product!: Product;
  @Input({ required: true }) categories!: Category[];
  @Input() showAddToCart = false;
  @Input() catalogProducts: Product[] = [];
  @Input() profitMargins: ServiceProfitMargins | null = null;
  @Input() wholesaleDiscount: WholesaleDiscountSettings | null = null;
  @Output() edit = new EventEmitter<Product>();
  @Output() delete = new EventEmitter<Product>();
  @Output() addToCart = new EventEmitter<Product>();

  menuOpen = false;

  get categoryNames(): string {
    return resolveCategoryNamesText(this.product.categoryIds, this.categories);
  }

  get finishedStock(): number {
    return productListStock(this.product);
  }

  /** «Sin stock» solo importa si hay stock reservado; con 0 y sin reservas no se muestra. */
  get showStockPill(): boolean {
    return (
      this.finishedStock > 0 || (this.product.stockOverview?.reserved ?? 0) > 0
    );
  }

  get canAddToCart(): boolean {
    return this.product.published !== false;
  }

  /** Sin stock → pedido (§8); con stock → venta de mostrador vía carrito. */
  get cartButtonLabel(): string {
    return this.finishedStock > 0 ? 'Agregar al carrito' : 'Agregar para pedido';
  }

  get hasFixedPrice(): boolean {
    return hasFixedCatalogPrice(this.product);
  }

  get piecesSum(): number | null {
    if (!productUsesPieceAssembly(this.product)) return null;
    if (!(this.product.components?.length > 0)) return null;
    const catalog =
      this.catalogProducts.length > 0 ? this.catalogProducts : [this.product];
    const sum = resolveProductUnitPrice(this.product, catalog);
    return sum > 0 ? sum : null;
  }

  get listPrice(): number {
    return Number(this.product.price) || 0;
  }

  /** Null si el área no aplica o el descuento está inactivo → mostrar «—». */
  get wholesalePrice(): number | null {
    const area = resolveProfitArea(this.product);
    const discount = normalizeWholesaleDiscount(this.wholesaleDiscount);
    if (
      !discount.enabled ||
      !area ||
      !discount.serviceTypes.includes(area)
    ) {
      return null;
    }
    return wholesalePriceFromList(this.listPrice, discount.percent);
  }

  get markupPercent(): number | null {
    return markupPercentOnCostRounded(this.listPrice, this.product.cost);
  }

  get targetMarginPercent(): number {
    if (!this.profitMargins) return 0;
    return getMarginForProductType(this.product.type, this.profitMargins);
  }

  get meetsTargetMargin(): boolean {
    const markup = this.markupPercent;
    if (markup == null) return true;
    return markup >= this.targetMarginPercent;
  }

  get marginBarWidth(): number {
    const markup = this.markupPercent;
    if (markup == null) return 0;
    return Math.min(Math.max(markup, 0), 100);
  }

  get specLine(): string {
    const product = this.product;
    if (product.components?.length) {
      const count = product.components.length;
      return `${count} ${count === 1 ? 'pieza' : 'piezas'}`;
    }
    if (isProduct3D(product)) {
      const parts: string[] = [];
      const size = product.size?.trim();
      if (size) parts.push(size);
      if (product.grams > 0) {
        const unit = product.type === ProductType.RESINA ? 'ml' : 'g';
        parts.push(`${this.formatQty(product.grams)} ${unit}`);
      }
      if (product.printTimeHours > 0) {
        const hours = `${this.formatQty(product.printTimeHours)} h`;
        parts.push(size ? `${hours} imp.` : `${hours} impresión`);
      }
      return parts.join(' · ');
    }
    if (product.type === ProductType.ESTAMPADO) {
      return this.estampadoSpec(product);
    }
    return product.size?.trim() ?? '';
  }

  toggleMenu(): void {
    this.menuOpen = !this.menuOpen;
  }

  private estampadoSpec(product: ProductEstampado): string {
    const line = (product.prints ?? [])
      .map((print) => {
        const size = hasValidPrintSize(print.widthCm, print.lengthCm, print.heightCm)
          ? formatPrintDimensionsCm(print.widthCm!, print.lengthCm, print.heightCm)
          : '';
        const label = print.label?.trim() || PAPER_TYPE_LABELS[print.paperType] || '';
        return [label, size].filter(Boolean).join(' ');
      })
      .filter(Boolean)
      .join(' · ');
    return line || product.size?.trim() || '';
  }

  private formatQty(value: number): string {
    return new Intl.NumberFormat('es-AR', {
      maximumFractionDigits: 1,
    }).format(value);
  }
}
