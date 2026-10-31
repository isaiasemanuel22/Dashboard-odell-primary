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
import { resolveCategoryNamesText } from '../../shared/utils/product.helpers';
import { productPhysicalStock } from '../../shared/utils/stock.helpers';
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
  @Output() edit = new EventEmitter<Product>();
  @Output() delete = new EventEmitter<Product>();
  @Output() addToCart = new EventEmitter<Product>();

  menuOpen = false;

  get categoryNames(): string {
    return resolveCategoryNamesText(this.product.categoryIds, this.categories);
  }

  get finishedStock(): number {
    return productPhysicalStock(this.product);
  }

  get canAddToCart(): boolean {
    return this.product.published !== false;
  }

  /** Sin stock → pedido (§8); con stock → venta de mostrador vía carrito. */
  get cartButtonLabel(): string {
    return this.finishedStock > 0 ? 'Agregar al carrito' : 'Agregar para pedido';
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
