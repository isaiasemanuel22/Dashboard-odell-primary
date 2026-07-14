import { Component, Input } from '@angular/core';
import { ProductType } from '../../core/models';
import { ProductTypeLabelPipe } from '../../shared/pipes/labels.pipe';

@Component({
  selector: 'app-product-badges',
  standalone: true,
  imports: [ProductTypeLabelPipe],
  template: `
    <span class="type-badge" [class.type-badge--overlay]="overlay">{{ type | productTypeLabel }}</span>
    @if (!published) {
      <span class="internal-badge" [class.internal-badge--overlay]="overlay">
        {{ internalLabel }}
      </span>
    }
  `,
})
export class ProductBadgesComponent {
  @Input({ required: true }) type!: ProductType;
  @Input() published = true;
  @Input() overlay = false;
  @Input() internalLabel = 'Interno';
}
