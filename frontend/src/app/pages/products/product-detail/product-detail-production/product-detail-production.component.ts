import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { ColorConfig, Product, Product3D } from '../../../../core/models';
import {
  FilamentTypeLabelPipe,
  ResinTypeLabelPipe,
} from '../../../../shared/pipes/labels.pipe';
import { resolveColorHex, resolveColorLabel } from '../../../../shared/utils/color.helpers';
import {
  resolveProductGrams,
  resolveProductPrintTimeHours,
  resolveProductWorkTimeHours,
} from '../../../../shared/utils/product.helpers';

@Component({
  selector: 'app-product-detail-production',
  standalone: true,
  imports: [FilamentTypeLabelPipe, ResinTypeLabelPipe],
  templateUrl: './product-detail-production.component.html',
  styleUrl: './product-detail-production.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductDetailProductionComponent {
  @Input({ required: true }) product!: Product3D;
  @Input() hasComponents = false;
  @Input() catalogProducts: Product[] = [];
  @Input() colorCatalog: ColorConfig[] = [];

  get grams(): number {
    return resolveProductGrams(this.product, this.catalogProducts);
  }

  get printHours(): number {
    return resolveProductPrintTimeHours(this.product, this.catalogProducts);
  }

  get workHours(): number {
    return resolveProductWorkTimeHours(this.product, this.catalogProducts);
  }

  colorLabel(colorId?: string): string {
    return resolveColorLabel(colorId, this.colorCatalog);
  }

  colorHex(colorId?: string): string | undefined {
    return resolveColorHex(colorId, this.colorCatalog);
  }
}
