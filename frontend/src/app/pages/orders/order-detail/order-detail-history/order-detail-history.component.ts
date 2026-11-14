import {
  ChangeDetectionStrategy,
  Component,
  Input,
} from '@angular/core';
import {
  OrderPriceHistoryEntry,
  OrderStatusHistoryEntry,
} from '../../../../core/models';
import { DbStatusBadgeComponent } from '@general-components';
import { ORDER_STATUS_CHANGE_SOURCE_LABELS, ORDER_STATUS_LABELS } from '../../../../shared/constants/labels';
import {
  CurrencyArsPipe,
  DateTimePipe,
  OrderStatusLabelPipe,
} from '../../../../shared/pipes/labels.pipe';

@Component({
  selector: 'app-order-detail-history',
  standalone: true,
  imports: [
    DateTimePipe,
    CurrencyArsPipe,
    OrderStatusLabelPipe,
    DbStatusBadgeComponent,
  ],
  templateUrl: './order-detail-history.component.html',
  styleUrl: './order-detail-history.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderDetailHistoryComponent {
  @Input() statusHistory: OrderStatusHistoryEntry[] = [];
  @Input() priceHistory: OrderPriceHistoryEntry[] = [];
  /** Presupuesto de origen, para rotular la creación del pedido. */
  @Input() sourceQuoteId: string | null = null;

  readonly sourceLabels = ORDER_STATUS_CHANGE_SOURCE_LABELS;
  readonly priceTriggerLabels: Record<OrderPriceHistoryEntry['trigger'], string> = {
    settings: 'Ajustes del sistema',
    supply_price: 'Precio de insumo',
    product_update: 'Actualización de producto',
    bulk_price: 'Precios en bloque',
    discount_change: 'Cambio de descuento',
  };

  /** La creación no la hizo la cola de trabajo: se dice de dónde viene el pedido. */
  historySourceLabel(entry: OrderStatusHistoryEntry): string {
    if (entry.fromStatus === null) {
      return this.sourceQuoteId
        ? `Creado desde presupuesto ${this.sourceQuoteId}`
        : 'Creación del pedido';
    }
    return this.sourceLabels[entry.source];
  }

  historyTransition(entry: OrderStatusHistoryEntry): string {
    if (entry.fromStatus === null) {
      return `Creación → ${ORDER_STATUS_LABELS[entry.toStatus]}`;
    }
    return `${ORDER_STATUS_LABELS[entry.fromStatus]} → ${ORDER_STATUS_LABELS[entry.toStatus]}`;
  }
}
