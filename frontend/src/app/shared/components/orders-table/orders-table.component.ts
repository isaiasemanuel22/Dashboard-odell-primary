import { Component, Input } from '@angular/core';
import { Order } from '../../../core/models';
import {
  CurrencyArsPipe,
  DateShortPipe,
  OrderStatusLabelPipe,
} from '../../pipes/labels.pipe';
import { DbServiceBadgeComponent } from '../db-service-badge/db-service-badge.component';
import { DbStatusBadgeComponent } from '../db-status-badge/db-status-badge.component';

@Component({
  selector: 'app-orders-table',
  standalone: true,
  imports: [
    CurrencyArsPipe,
    DateShortPipe,
    OrderStatusLabelPipe,
    DbServiceBadgeComponent,
    DbStatusBadgeComponent,
  ],
  templateUrl: './orders-table.component.html',
})
export class OrdersTableComponent {
  @Input({ required: true }) orders!: Order[];
  /** Vista resumida para dashboard (sin ID ni productos). */
  @Input() compact = false;
  /** Sin contenedor table-card (ej. dentro de un panel). */
  @Input() embedded = false;
}
