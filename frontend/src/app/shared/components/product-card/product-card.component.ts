import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Category, Product, isProduct3D } from '../../../core/models';
import { resolveCategoryNamesText } from '../../utils/product.helpers';
import { DateShortPipe } from '../../pipes/labels.pipe';
import { ProductBadgesComponent } from '../product-badges/product-badges.component';
import { ProductPricingComponent } from '../product-pricing/product-pricing.component';
import { GeneralComponentsModule } from '@general-components';

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [
    RouterLink,
    DateShortPipe,
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
  @Output() edit = new EventEmitter<Product>();
  @Output() delete = new EventEmitter<Product>();

  isProduct3D = isProduct3D;

  get categoryNames(): string {
    return resolveCategoryNamesText(this.product.categoryIds, this.categories);
  }
}
