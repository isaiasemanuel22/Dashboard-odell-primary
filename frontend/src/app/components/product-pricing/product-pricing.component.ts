import { Component, Input } from '@angular/core';
import { CurrencyArsPipe } from '../../shared/pipes/labels.pipe';

@Component({
  selector: 'app-product-pricing',
  standalone: true,
  imports: [CurrencyArsPipe],
  templateUrl: './product-pricing.component.html',
})
export class ProductPricingComponent {
  @Input({ required: true }) price!: number;
  @Input({ required: true }) cost!: number;
  @Input({ required: true }) profit!: number;
  @Input() layout: 'compact' | 'grid' = 'compact';
  @Input() showMargin = false;
  @Input() priceLabel = 'Precio';
  @Input() costLabel = 'Costo';
  @Input() profitLabel = 'Ganancia';

  get marginPercent(): number | null {
    if (!this.showMargin || this.price <= 0) return null;
    return Math.round((this.profit / this.price) * 100);
  }
}
