import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Order } from '../../core/models';
import {
  CurrencyArsPipe,
  DateShortPipe,
  OrderStatusLabelPipe,
  ServiceTypeLabelPipe,
  PlainTextPipe,
} from '../../shared/pipes/labels.pipe';
import { DbServiceBadgesComponent } from '../db-service-badges/db-service-badges.component';
import { DbStatusBadgeComponent } from '../db-status-badge/db-status-badge.component';
import { DbButtonComponent } from '@general-components';

@Component({
  selector: 'app-orders-table',
  standalone: true,
  imports: [
    RouterLink,
    CurrencyArsPipe,
    DateShortPipe,
    OrderStatusLabelPipe,
    ServiceTypeLabelPipe,
    PlainTextPipe,
    DbServiceBadgesComponent,
    DbStatusBadgeComponent,
    DbButtonComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './orders-table.component.html',
})
export class OrdersTableComponent {
  @Input({ required: true }) orders!: Order[];
  /** Vista resumida para dashboard (sin ID ni productos). */
  @Input() compact = false;
  /** Sin contenedor table-card (ej. dentro de un panel). */
  @Input() embedded = false;
  /** Muestra columna de acciones (listado de pedidos). */
  @Input() showActions = false;
  @Output() edit = new EventEmitter<Order>();
  @Output() delete = new EventEmitter<Order>();
}
