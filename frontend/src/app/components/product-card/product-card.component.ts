import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Category, Product, isProduct3D } from '../../core/models';
import { resolveCategoryNamesText } from '../../shared/utils/product.helpers';
import { DateShortPipe, MediaUrlPipe } from '../../shared/pipes/labels.pipe';
import { ProductBadgesComponent } from '../product-badges/product-badges.component';
import { ProductPricingComponent } from '../product-pricing/product-pricing.component';
import { DbButtonComponent } from '@general-components';

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [
    RouterLink,
    DateShortPipe,
    MediaUrlPipe,
    ProductBadgesComponent,
    ProductPricingComponent,
    DbButtonComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
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
