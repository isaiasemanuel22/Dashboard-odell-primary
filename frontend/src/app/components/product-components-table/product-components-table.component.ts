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
  Product,
  ProductComponent,
  Supply,
} from '../../core/models';
import {
  getComponentLineCost,
  getComponentLinePrice,
  getProductName,
} from '../../shared/utils/product.helpers';
import {
  buildColorOptionsForProduct,
  resolveColorHex,
  resolveColorLabel,
} from '../../shared/utils/color.helpers';
import { CurrencyArsPipe } from '../../shared/pipes/labels.pipe';
import { DbButtonComponent } from '../db-button/db-button.component';
import { DbColorSelectComponent } from '../dashboard-form/db-color-select/db-color-select.component';
import type { DbColorSelectOption } from '../dashboard-form/db-color-select/db-color-select.types';

@Component({
  selector: 'app-product-components-table',
  standalone: true,
  imports: [
    RouterLink,
    FormsModule,
    CurrencyArsPipe,
    DbButtonComponent,
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
  @Input() colorCatalog: ColorConfig[] = [];
  @Input() supplies: Supply[] = [];
  @Output() remove = new EventEmitter<string>();
  @Output() colorChange = new EventEmitter<{
    productId: string;
    colorId: string;
  }>();

  getName(id: string): string {
    return getProductName(this.catalog, id);
  }

  getLineCost(item: ProductComponent): number {
    return getComponentLineCost(this.catalog, item.productId, item.quantity);
  }

  getLinePrice(item: ProductComponent): number {
    return getComponentLinePrice(this.catalog, item.productId, item.quantity);
  }

  getPieceProduct(productId: string): Product | undefined {
    return this.catalog.find((product) => product.id === productId);
  }

  colorOptions(item: ProductComponent): DbColorSelectOption[] {
    return buildColorOptionsForProduct(
      this.getPieceProduct(item.productId),
      this.supplies,
      this.colorCatalog,
    );
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
}
