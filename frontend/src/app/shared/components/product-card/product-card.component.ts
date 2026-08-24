import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Category, Product, isProductType3D } from '../../../core/models';
import {
  productUsesPieceAssembly,
  resolveCategoryNamesText,
  resolveProductUnitCost,
  resolveProductUnitPrice,
} from '../../utils/product.helpers';
import { productPhysicalStock } from '../../utils/stock.helpers';
import { DateShortPipe, MediaUrlPipe } from '../../pipes/labels.pipe';
import { ProductBadgesComponent } from '../product-badges/product-badges.component';
import { ProductPricingComponent } from '../product-pricing/product-pricing.component';
import { GeneralComponentsModule } from '@general-components';

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [
    RouterLink,
    DateShortPipe,
    MediaUrlPipe,
    ProductBadgesComponent,
    ProductPricingComponent,
    GeneralComponentsModule,
  ],
  templateUrl: './product-card.component.html',
  styleUrl: './product-card.component.scss',
})
export class ProductCardComponent {
  @Input({ required: true }) product!: Product;
  @Input({ required: true }) categories!: Category[];
  @Input() catalog: Product[] = [];
  @Output() edit = new EventEmitter<Product>();
  @Output() delete = new EventEmitter<Product>();

  isProduct3D = isProductType3D;

  get displayPrice(): number {
    if (this.hasCompositePricing) {
      return resolveProductUnitPrice(this.product, this.catalogProducts);
    }
    return this.product.price ?? 0;
  }

  get displayCost(): number {
    if (this.hasCompositePricing) {
      const partsCost = resolveProductUnitCost(this.product, this.catalogProducts);
      const stored = this.product.cost ?? 0;
      return Math.max(partsCost, stored);
    }
    return this.product.cost ?? 0;
  }

  get displayProfit(): number {
    return this.displayPrice - this.displayCost;
  }

  private get catalogProducts(): Product[] {
    return this.catalog.length ? this.catalog : [this.product];
  }

  private get hasCompositePricing(): boolean {
    return productUsesPieceAssembly(this.product);
  }
  productPhysicalStock = productPhysicalStock;

  get categoryNames(): string {
    return resolveCategoryNamesText(this.product.categoryIds, this.categories);
  }
}
