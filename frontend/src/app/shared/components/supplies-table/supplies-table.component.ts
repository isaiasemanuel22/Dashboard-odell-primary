import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Supply } from '../../../core/models';
import { CurrencyArsPipe, SupplyTypeLabelPipe } from '../../pipes/labels.pipe';
import { DbStockBadgeComponent } from '../db-stock-badge/db-stock-badge.component';
import { GeneralComponentsModule } from '@general-components';

@Component({
  selector: 'app-supplies-table',
  standalone: true,
  imports: [
    CurrencyArsPipe,
    SupplyTypeLabelPipe,
    DbStockBadgeComponent,
    GeneralComponentsModule,
  ],
  templateUrl: './supplies-table.component.html',
})
export class SuppliesTableComponent {
  @Input({ required: true }) supplies!: Supply[];
  @Output() edit = new EventEmitter<Supply>();
  @Output() delete = new EventEmitter<Supply>();

  isLowStock(s: Supply): boolean {
    return s.quantity <= s.minStock;
  }

  materialLabel(s: Supply): string {
    if (s.filamentType) return s.filamentType.toUpperCase();
    if (s.resinType) return s.resinType;
    return '—';
  }
}
