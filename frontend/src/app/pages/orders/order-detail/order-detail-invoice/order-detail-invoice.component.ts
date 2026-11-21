import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  Output,
  inject,
} from '@angular/core';
import { DbButtonComponent } from '@general-components';
import { Order } from '../../../../core/models';
import { OrdersService } from '../../../../core/services/orders.service';
import { FormDialogService } from '../../../../modals/public-api';
import { extractApiErrorMessage } from '../../../../shared/utils/api-error';
import { DateShortPipe } from '../../../../shared/pipes/labels.pipe';

/** Tarjeta «Factura» del pedido: factura C marcada a mano (§29.4). */
@Component({
  selector: 'app-order-detail-invoice',
  standalone: true,
  imports: [DbButtonComponent, DateShortPipe],
  templateUrl: './order-detail-invoice.component.html',
  styleUrl: './order-detail-invoice.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderDetailInvoiceComponent {
  private readonly ordersService = inject(OrdersService);
  private readonly formDialogs = inject(FormDialogService);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input({ required: true }) order!: Order;
  /** CUIT del cliente o «Consumidor final». */
  @Input() receiver = 'Consumidor final';
  /** Punto de venta de Integraciones (precarga el diálogo). */
  @Input() pointOfSale: number | null = null;
  @Output() orderChange = new EventEmitter<Order>();

  loading = false;
  errorMessage = '';

  get cancelled(): boolean {
    return this.order.status === 'cancelado';
  }

  markInvoice(): void {
    if (this.loading || this.cancelled) return;
    this.formDialogs
      .openInvoiceMark({ saleLabel: this.order.id, pointOfSale: this.pointOfSale })
      .subscribe((result) => {
        if (!result) return;
        this.run(this.ordersService.markInvoice(this.order.id, result), 'No se pudo marcar la factura');
      });
  }

  removeInvoice(): void {
    if (this.loading || !this.order.invoice) return;
    this.formDialogs
      .openConfirm({
        title: 'Quitar factura',
        message: `¿Quitar la factura ${this.order.invoice.number} del pedido ${this.order.id}? La factura emitida no se anula: solo se desmarca en Odell.`,
        confirmLabel: 'Quitar factura',
        confirmVariant: 'delete',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.run(this.ordersService.removeInvoice(this.order.id), 'No se pudo quitar la factura');
      });
  }

  private run(request: ReturnType<OrdersService['markInvoice']>, fallback: string): void {
    this.loading = true;
    this.errorMessage = '';
    this.cdr.markForCheck();
    request.subscribe({
      next: (order) => {
        this.loading = false;
        this.orderChange.emit(order);
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = extractApiErrorMessage(err, fallback);
        this.cdr.markForCheck();
      },
    });
  }
}
