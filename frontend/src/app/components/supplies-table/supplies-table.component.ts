import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { ColorConfig, Supply } from '../../core/models';
import { RESIN_TYPE_LABELS } from '../../shared/constants/labels';
import {
  CurrencyArsPipe,
  SupplyCategoryLabelPipe,
} from '../../shared/pipes/labels.pipe';
import {
  resolveColorHex,
  resolveColorLabel,
  supplyRequiresColor,
} from '../../shared/utils/color.helpers';
import { DbStockBadgeComponent } from '../db-stock-badge/db-stock-badge.component';
import { DbButtonComponent } from '../db-button/db-button.component';

@Component({
  selector: 'app-supplies-table',
  standalone: true,
  imports: [
    CurrencyArsPipe,
    SupplyCategoryLabelPipe,
    DbStockBadgeComponent,
    DbButtonComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './supplies-table.component.html',
  styleUrl: './supplies-table.component.scss',
})
export class SuppliesTableComponent {
  @Input({ required: true }) supplies!: Supply[];
  @Input() colorCatalog: ColorConfig[] = [];
  @Output() edit = new EventEmitter<Supply>();
  @Output() delete = new EventEmitter<Supply>();

  isLowStock(s: Supply): boolean {
    return s.quantity <= s.minStock;
  }

  materialLabel(s: Supply): string {
    if (s.filamentType) return s.filamentType.toUpperCase();
    if (s.resinType) {
      return RESIN_TYPE_LABELS[s.resinType] ?? s.resinType;
    }
    return '—';
  }

  showColor(s: Supply): boolean {
    return supplyRequiresColor(s.category);
  }

  colorLabel(s: Supply): string {
    return resolveColorLabel(s.colorId, this.colorCatalog);
  }

  colorHex(s: Supply): string | undefined {
    return resolveColorHex(s.colorId, this.colorCatalog);
  }
}
