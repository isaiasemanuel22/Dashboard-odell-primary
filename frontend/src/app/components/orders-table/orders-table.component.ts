import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  inject,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Order } from '../../core/models';
import { ServiceTypeLabelPipe } from '../../shared/pipes/labels.pipe';
import { plainTextFromHtml } from '../../shared/utils/rich-text.util';
import { DbServiceBadgesComponent } from '../db-service-badges/db-service-badges.component';
import {
  DB_DATA_TABLE,
  OdlActionEvent,
  OdlColumn,
  OdlRowAction,
  orderStatusBadge,
} from '../db-data-table';

@Component({
  selector: 'app-orders-table',
  standalone: true,
  imports: [RouterLink, ServiceTypeLabelPipe, DbServiceBadgesComponent, ...DB_DATA_TABLE],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './orders-table.component.html',
})
export class OrdersTableComponent {
  private readonly router = inject(Router);

  @Input({ required: true }) orders!: Order[];
  /** Vista resumida para dashboard (sin ID ni productos). */
  @Input() compact = false;
  /** Sin contenedor table-card (ej. dentro de un panel). */
  @Input() embedded = false;
  /** Muestra columna de acciones (listado de pedidos). */
  @Input() showActions = false;
  @Output() edit = new EventEmitter<Order>();
  @Output() delete = new EventEmitter<Order>();

  get columns(): OdlColumn<Order>[] {
    const columns: OdlColumn<Order>[] = [];
    if (!this.compact) columns.push({ key: 'id', header: 'ID' });
    columns.push(
      {
        key: 'customerName',
        header: 'Cliente',
        type: 'primary',
        secondary: (order) => {
          if (this.compact) return null;
          const description = plainTextFromHtml(order.description).slice(0, 80);
          return [description, order.notes].filter(Boolean).join(' · ') || null;
        },
      },
      { key: 'services', header: 'Servicios' },
    );
    if (!this.compact) columns.push({ key: 'products', header: 'Productos' });
    columns.push(
      { key: 'status', header: 'Estado', type: 'badge', badge: (order) => orderStatusBadge(order.status) },
      { key: 'total', header: 'Total', type: 'money' },
      { key: 'dueDate', header: 'Entrega', type: 'date' },
    );
    return columns;
  }

  get rowActions(): OdlRowAction<Order>[] {
    if (!this.showActions) return [];
    return [
      { id: 'ver', label: 'Ver' },
      { id: 'editar', label: 'Editar' },
      { id: 'eliminar', label: 'Eliminar', danger: true },
    ];
  }

  onAction(event: OdlActionEvent<Order>): void {
    if (event.actionId === 'ver') void this.router.navigate(['/pedidos', event.row.id]);
    if (event.actionId === 'editar') this.edit.emit(event.row);
    if (event.actionId === 'eliminar') this.delete.emit(event.row);
  }
}
