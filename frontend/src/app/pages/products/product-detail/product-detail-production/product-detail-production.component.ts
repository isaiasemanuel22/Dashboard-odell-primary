import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import {
  ColorConfig,
  GeneralSettings,
  MachineProfileRole,
  Product,
  Product3D,
  ProductType,
} from '../../../../core/models';
import {
  DecimalEsPipe,
  FilamentTypeLabelPipe,
  ResinTypeLabelPipe,
} from '../../../../shared/pipes/labels.pipe';
import { resolveColorHex, resolveColorLabel } from '../../../../shared/utils/color.helpers';
import { normalizePurgeGrams, normalizeColorChanges } from '../../../../shared/utils/fdm.helpers';
import { getMachineProfilesForProductType } from '../../../../shared/utils/machine-profile.util';
import {
  resolveProductGrams,
  resolveProductPrintTimeHours,
  resolveProductWorkTimeHours,
} from '../../../../shared/utils/product.helpers';

@Component({
  selector: 'app-product-detail-production',
  standalone: true,
  imports: [DecimalEsPipe, FilamentTypeLabelPipe, ResinTypeLabelPipe],
  templateUrl: './product-detail-production.component.html',
  styleUrl: './product-detail-production.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductDetailProductionComponent {
  @Input({ required: true }) product!: Product3D;
  @Input() hasComponents = false;
  @Input() catalogProducts: Product[] = [];
  @Input() colorCatalog: ColorConfig[] = [];
  @Input() generalSettings: GeneralSettings | null = null;

  get grams(): number {
    return resolveProductGrams(this.product, this.catalogProducts);
  }

  get printHours(): number {
    return resolveProductPrintTimeHours(this.product, this.catalogProducts);
  }

  get workHours(): number {
    return resolveProductWorkTimeHours(this.product, this.catalogProducts);
  }

  get purgeGrams(): number | null {
    if (this.product.type !== ProductType.FDM) return null;
    return normalizePurgeGrams(this.product.purgeGrams);
  }

  get colorChanges(): number | null {
    if (this.product.type !== ProductType.FDM) return null;
    return normalizeColorChanges(this.product.colorChanges);
  }

  get preferredPrinterName(): string | null {
    if (this.product.type !== ProductType.FDM) return null;
    const id = this.product.preferredPrinterId?.trim();
    if (!id || !this.generalSettings) return null;
    const printers = getMachineProfilesForProductType(
      this.generalSettings,
      ProductType.FDM,
    ).filter((p) => p.role === MachineProfileRole.PRINT && !!p.queueEnabled);
    return printers.find((p) => p.id === id)?.name ?? null;
  }

  colorLabel(colorId?: string): string {
    return resolveColorLabel(colorId, this.colorCatalog);
  }

  colorHex(colorId?: string): string | undefined {
    return resolveColorHex(colorId, this.colorCatalog);
  }
}
