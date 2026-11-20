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
  /** Mano de obra incluida en el costo: no lleva margen y se descuenta de la base del %. */
  @Input() laborCost = 0;
  /** Margen del proceso (§16.1.1). Si viene, se muestra en vez del margen sin mano de obra. */
  @Input() processMarginPercent: number | null = null;
  /** Margen total sobre el costo total. Solo se muestra junto al del proceso. */
  @Input() totalMarginPercent: number | null = null;
  @Input() priceLabel = 'Precio';
  @Input() costLabel = 'Costo';
  @Input() profitLabel = 'Ganancia';

  get marginPercent(): number | null {
    if (!this.showMargin) return null;
    if (this.processMarginPercent != null) return this.processMarginPercent;
    return markupPercentOnCostRounded(this.price, this.cost, this.laborCost);
  }
}
