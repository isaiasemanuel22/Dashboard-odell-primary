import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  ColorConfig,
  FilamentType,
  Product,
  ProductComponent,
  ProductType,
  ResinType,
  SupplyCategory,
} from '../../core/models';
import { PRODUCT_TYPE_LABELS } from '../../shared/constants/labels';
import {
  getComponentLineCost,
  getProductName,
  isProductPublished,
  resolveProductUnitCost,
} from '../../shared/utils/product.helpers';
import {
  resolveColorHex,
  resolveColorLabel,
} from '../../shared/utils/color.helpers';
import { productPhysicalStock } from '../../shared/utils/stock.helpers';
import { CurrencyArsPipe } from '../../shared/pipes/labels.pipe';
import { DbColorSelectComponent } from '../dashboard-form/db-color-select/db-color-select.component';

@Component({
  selector: 'app-product-components-table',
  standalone: true,
  imports: [
    RouterLink,
    FormsModule,
    CurrencyArsPipe,
    DbColorSelectComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-components-table.component.html',
  styleUrl: './product-components-table.component.scss',
})
export class ProductComponentsTableComponent {
  @Input({ required: true }) components!: ProductComponent[];
  @Input({ required: true }) catalog!: Product[];
  @Input() mode: 'read' | 'edit' = 'read';
  /** Sin marco propio: el contenedor quote del form aporta el borde. */
  @Input() embedded = false;
  /** Solo para labels de color en modo lectura. */
  @Input() colorCatalog: ColorConfig[] = [];
  @Output() remove = new EventEmitter<string>();
  @Output() colorChange = new EventEmitter<{
    productId: string;
    colorId: string;
  }>();
  @Output() quantityChange = new EventEmitter<{
    productId: string;
    quantity: number;
  }>();

  getName(id: string): string {
    return getProductName(this.catalog, id);
  }

  getUnitCost(productId: string): number {
    return resolveProductUnitCost(this.getPieceProduct(productId), this.catalog);
  }

  getLineCost(item: ProductComponent): number {
    return getComponentLineCost(this.catalog, item.productId, item.quantity);
  }

  getPieceProduct(productId: string): Product | undefined {
    return this.catalog.find((product) => product.id === productId);
  }

  thumb(productId: string): string | null {
    return this.getPieceProduct(productId)?.images?.[0] || null;
  }

  pieceMeta(productId: string): string {
    const product = this.getPieceProduct(productId);
    if (!product) return '';
    const type = PRODUCT_TYPE_LABELS[product.type] ?? product.type;
    const visibility = isProductPublished(product) ? 'publicado' : 'interno';
    const stock = productPhysicalStock(product);
    const stockLabel = stock > 0 ? `${stock} en stock` : 'sin stock';
    return `${type} · ${visibility} · ${stockLabel}`;
  }

  pieceFilamentType(productId: string): FilamentType | null {
    const product = this.getPieceProduct(productId);
    return product?.type === ProductType.FDM
      ? (product.filamentType ?? null)
      : null;
  }

  pieceResinType(productId: string): ResinType | string | null {
    const product = this.getPieceProduct(productId);
    return product?.type === ProductType.RESINA
      ? (product.resinType ?? null)
      : null;
  }

  pieceSupplyCategory(productId: string): SupplyCategory | null {
    const product = this.getPieceProduct(productId);
    return product?.type === ProductType.ESTAMPADO
      ? SupplyCategory.ESTAMPADO
      : null;
  }

  colorLabel(colorId?: string): string {
    return resolveColorLabel(colorId, this.colorCatalog);
  }

  colorHex(colorId?: string): string | undefined {
    return resolveColorHex(colorId, this.colorCatalog);
  }

  onColorChange(productId: string, colorId: string): void {
    this.colorChange.emit({ productId, colorId });
  }

  bumpQuantity(productId: string, delta: number): void {
    const current =
      this.components.find((item) => item.productId === productId)?.quantity ?? 1;
    this.quantityChange.emit({
      productId,
      quantity: Math.max(1, current + delta),
    });
  }

  onQuantityInput(productId: string, value: string | number): void {
    const quantity = Math.max(1, Math.floor(Number(value) || 1));
    this.quantityChange.emit({ productId, quantity });
  }
}
