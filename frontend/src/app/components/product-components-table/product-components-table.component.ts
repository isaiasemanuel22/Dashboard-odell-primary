import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Product, ProductComponent } from '../../core/models';
import {
  getComponentLineCost,
  getComponentLinePrice,
  getProductName,
} from '../../shared/utils/product.helpers';
import { CurrencyArsPipe } from '../../shared/pipes/labels.pipe';
import { DbButtonComponent } from '@general-components';

@Component({
  selector: 'app-product-components-table',
  standalone: true,
  imports: [RouterLink, CurrencyArsPipe, DbButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-components-table.component.html',
})
export class ProductComponentsTableComponent {
  @Input({ required: true }) components!: ProductComponent[];
  @Input({ required: true }) catalog!: Product[];
  @Input() mode: 'read' | 'edit' = 'read';
  @Output() remove = new EventEmitter<string>();

  getName(id: string): string {
    return getProductName(this.catalog, id);
  }

  getLineCost(item: ProductComponent): number {
    return getComponentLineCost(this.catalog, item.productId, item.quantity);
  }

  getLinePrice(item: ProductComponent): number {
    return getComponentLinePrice(this.catalog, item.productId, item.quantity);
  }
}
