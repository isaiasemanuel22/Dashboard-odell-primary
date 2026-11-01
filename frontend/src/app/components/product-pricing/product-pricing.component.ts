import { Component, Input } from '@angular/core';
import { CurrencyArsPipe } from '../../shared/pipes/labels.pipe';
import { markupPercentOnCostRounded } from '../../shared/utils/product-margin.util';

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
  /** Margen objetivo del área del producto (sobre el costo). */
  @Input() targetMarginPercent: number | null = null;
  @Input() priceLabel = 'Precio';
  @Input() costLabel = 'Costo';
  @Input() profitLabel = 'Ganancia';

  get marginPercent(): number | null {
    if (!this.showMargin) return null;
    return markupPercentOnCostRounded(this.price, this.cost);
  }
}
