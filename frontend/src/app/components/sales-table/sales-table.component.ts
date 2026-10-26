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
import { SaleEntryCardComponent } from '../sale-entry-card/sale-entry-card.component';
import { SaleEntryItemComponent } from '../sale-entry-item/sale-entry-item.component';
import { SaleSourceBadgeComponent } from '../sale-source-badge/sale-source-badge.component';

@Component({
  selector: 'app-sales-table',
  standalone: true,
  imports: [
    RouterLink,
    SaleEntryCardComponent,
    SaleEntryItemComponent,
    SaleSourceBadgeComponent,
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

  onAction(event: OdlActionEvent<SaleEntry>): void {
    if (event.actionId === 'editar') this.edit.emit(event.row);
    if (event.actionId === 'eliminar') this.delete.emit(event.row);
    if (event.actionId === 'ver' && event.row.orderId) {
      void this.router.navigate(['/pedidos', event.row.orderId]);
    }
  }
}
