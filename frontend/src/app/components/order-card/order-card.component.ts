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
} from '../../shared/pipes/labels.pipe';
import { DbServiceBadgesComponent } from '../db-service-badges/db-service-badges.component';
import { DbStatusBadgeComponent } from '../db-status-badge/db-status-badge.component';
import { DbButtonComponent } from '@general-components';

@Component({
  selector: 'app-order-card',
  standalone: true,
  imports: [
    RouterLink,
    CurrencyArsPipe,
    DateShortPipe,
    OrderStatusLabelPipe,
    ServiceTypeLabelPipe,
    DbServiceBadgesComponent,
    DbStatusBadgeComponent,
    DbButtonComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './order-card.component.html',
  styleUrl: './order-card.component.scss',
})
export class OrderCardComponent {
  @Input({ required: true }) order!: Order;
  @Output() edit = new EventEmitter<Order>();
  @Output() delete = new EventEmitter<Order>();

  readonly previewLimit = 3;

  previewItems(order: Order) {
    return order.items.slice(0, this.previewLimit);
  }

  hiddenItemsCount(order: Order): number {
    return Math.max(0, order.items.length - this.previewLimit);
  }
}
