import { Component, Input } from '@angular/core';
import { Material } from '../../../core/models';
import { ServiceTypeLabelPipe } from '../../pipes/labels.pipe';
import { DbServiceBadgeComponent } from '../db-service-badge/db-service-badge.component';
import { DbStockBadgeComponent } from '../db-stock-badge/db-stock-badge.component';

@Component({
  selector: 'app-materials-table',
  standalone: true,
  imports: [DbServiceBadgeComponent, DbStockBadgeComponent],
  templateUrl: './materials-table.component.html',
})
export class MaterialsTableComponent {
  @Input({ required: true }) materials!: Material[];

  isLowStock(quantity: number, minStock: number): boolean {
    return quantity <= minStock;
  }
}
