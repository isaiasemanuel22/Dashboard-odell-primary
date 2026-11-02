import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  inject,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { SaleEntry, SaleSource } from '../../core/models';
import { BreakpointService } from '../../core/services/breakpoint.service';
import {
  DB_DATA_TABLE,
  OdlActionEvent,
  OdlColumn,
  OdlRowAction,
} from '../db-data-table';
import { SaleEntryItemComponent } from '../sale-entry-item/sale-entry-item.component';
import { SaleSourceBadgeComponent } from '../sale-source-badge/sale-source-badge.component';
import { formatDateDayMonth } from '../../shared/utils/date-format.util';
import { pluralize } from '../../shared/utils/order.helpers';
import { salesChannelLabel } from '../../shared/utils/v1-labels.util';
import { CurrencyArsPipe } from '../../shared/pipes/labels.pipe';

@Component({
  selector: 'app-sales-table',
  standalone: true,
  imports: [
    RouterLink,
    SaleEntryItemComponent,
    SaleSourceBadgeComponent,
    CurrencyArsPipe,
    ...DB_DATA_TABLE,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sales-table.component.html',
  styleUrl: './sales-table.component.scss',
})
export class SalesTableComponent {
  private readonly breakpoint = inject(BreakpointService);
  private readonly router = inject(Router);

  @Input({ required: true }) entries!: SaleEntry[];
  @Output() edit = new EventEmitter<SaleEntry>();
  @Output() delete = new EventEmitter<SaleEntry>();

  readonly orderSource = SaleSource.ORDER;

  readonly columns: OdlColumn<SaleEntry>[] = [
    { key: 'saleId', header: 'ID' },
    { key: 'source', header: 'Origen' },
    { key: 'soldAt', header: 'Fecha', type: 'date' },
    { key: 'detail', header: 'Detalle' },
    { key: 'total', header: 'Total', type: 'money' },
    { key: 'cost', header: 'Costo', type: 'money' },
    { key: 'profit', header: 'Ganancia', type: 'signedMoney' },
  ];

  readonly actions: OdlRowAction<SaleEntry>[] = [
    { id: 'editar', label: 'Editar', hidden: (entry) => !entry.editable },
    { id: 'eliminar', label: 'Eliminar', danger: true, hidden: (entry) => !entry.editable },
    { id: 'ver', label: 'Ver pedido', hidden: (entry) => entry.editable || !entry.orderId },
  ];

  get isMobile(): boolean {
    return this.breakpoint.isMobile();
  }

  openEntry(entry: SaleEntry): void {
    if (entry.editable) {
      this.edit.emit(entry);
      return;
    }
    if (entry.orderId) {
      void this.router.navigate(['/pedidos', entry.orderId]);
    }
  }

  entryAvatar(entry: SaleEntry): string {
    if (entry.source === SaleSource.RETAIL) return 'M';
    return this.initials(entry.customerName || entry.saleId);
  }

  entryTitle(entry: SaleEntry): string {
    if (entry.source === SaleSource.RETAIL) {
      const note = entry.notes?.trim();
      if (note) return `Mostrador · ${note}`;
      const count = entry.items.reduce((sum, item) => sum + item.quantity, 0);
      return `Mostrador · ${pluralize(count, 'producto', 'productos')}`;
    }
    const customer = entry.customerName?.trim();
    return customer ? `${entry.saleId} · ${customer}` : entry.saleId;
  }

  entryMeta(entry: SaleEntry): string {
    const day = formatDateDayMonth(entry.soldAt);
    if (entry.source === SaleSource.RETAIL) {
      if (entry.editable) return `${day} · editable`;
      const count = entry.items.reduce((sum, item) => sum + item.quantity, 0);
      return `${day} · ${pluralize(count, 'producto', 'productos')}`;
    }
    const channel = salesChannelLabel(entry.salesChannel);
    return channel ? `Entregado ${day} · ${channel}` : `Entregado ${day}`;
  }

  onAction(event: OdlActionEvent<SaleEntry>): void {
    if (event.actionId === 'editar') this.edit.emit(event.row);
    if (event.actionId === 'eliminar') this.delete.emit(event.row);
    if (event.actionId === 'ver' && event.row.orderId) {
      void this.router.navigate(['/pedidos', event.row.orderId]);
    }
  }

  private initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  }
}
