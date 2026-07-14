import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  inject,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  Order,
  OrderStatus,
  OrderStatusHistoryEntry,
  PrintJob,
} from '../../../core/models';
import { RealtimeEvent } from '../../../core/models/realtime.model';
import { OrdersService } from '../../../core/services/orders.service';
import { PrintJobsService } from '../../../core/services/print-jobs.service';
import { RealtimeCatalogSyncService } from '../../../core/services/realtime-catalog-sync.service';
import { RealtimeService } from '../../../core/services/realtime.service';
import {
  DbButtonComponent,
  DbSelectComponent,
  DbServiceBadgesComponent,
  DbSkeletonComponent,
  DbStateMessageComponent,
  DbStatusBadgeComponent,
} from '@general-components';
import { FormDialogService } from '../../../shared/form-dialogs/public-api';
import { extractApiErrorMessage } from '../../../shared/utils/api-error';
import {
  orderStatusOptions,
  ORDER_DESCRIPTION_MAX_LENGTH,
} from '../../../shared/utils/order.helpers';
import {
  ORDER_STATUS_CHANGE_SOURCE_LABELS,
  ORDER_STATUS_LABELS,
} from '../../../shared/constants/labels';
import {
  CurrencyArsPipe,
  DateShortPipe,
  DateTimePipe,
  OrderStatusLabelPipe,
  PrintJobStatusLabelPipe,
  ServiceTypeLabelPipe,
} from '../../../shared/pipes/labels.pipe';
import { priorityTierClass } from '../../../shared/utils/priority.helpers';

@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    DateShortPipe,
    DateTimePipe,
    CurrencyArsPipe,
    OrderStatusLabelPipe,
    PrintJobStatusLabelPipe,
    ServiceTypeLabelPipe,
    DbSelectComponent,
    DbButtonComponent,
    DbSkeletonComponent,
    DbStateMessageComponent,
    DbStatusBadgeComponent,
    DbServiceBadgesComponent,
  ],
  templateUrl: './order-detail.component.html',
  styleUrl: './order-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly ordersService = inject(OrdersService);
  private readonly printJobsService = inject(PrintJobsService);
  private readonly catalogSync = inject(RealtimeCatalogSyncService);
  private readonly realtime = inject(RealtimeService);
  private readonly formDialogs = inject(FormDialogService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  order: Order | null = null;
  tasks: PrintJob[] = [];
  loading = true;
  notFound = false;

  statusDraft: OrderStatus = OrderStatus.PENDIENTE;
  statusLoading = false;

  readonly statusOptions = orderStatusOptions();
  readonly descriptionMaxLength = ORDER_DESCRIPTION_MAX_LENGTH;
  readonly priorityTierClass = priorityTierClass;
  readonly sourceLabels = ORDER_STATUS_CHANGE_SOURCE_LABELS;

  get statusHistory(): OrderStatusHistoryEntry[] {
    if (!this.order?.statusHistory?.length) return [];
    return [...this.order.statusHistory].sort(
      (a, b) =>
        new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime(),
    );
  }

  historyTransition(entry: OrderStatusHistoryEntry): string {
    if (entry.fromStatus === null) {
      return `Creación → ${ORDER_STATUS_LABELS[entry.toStatus]}`;
    }
    return `${ORDER_STATUS_LABELS[entry.fromStatus]} → ${ORDER_STATUS_LABELS[entry.toStatus]}`;
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (!id) {
        this.notFound = true;
        this.loading = false;
        this.cdr.markForCheck();
        return;
      }
      this.loadOrder(id);
    });

    this.realtime.bindSmartReload(
      this.destroyRef,
      ['orders', 'print-jobs', 'customers', 'products'],
      (event) => this.handleRealtime(event),
      {
        skip: () => this.statusLoading,
      },
    );
  }

  loadOrder(id: string): void {
    this.loading = true;
    this.notFound = false;
    this.cdr.markForCheck();

    this.ordersService.getOrderOverview(id).subscribe({
      next: (overview) => {
        this.order = overview.order;
        this.tasks = overview.tasks;
        this.statusDraft = overview.order.status;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loading = false;
        this.notFound = err.status === 404;
        this.cdr.markForCheck();
      },
    });
  }

  updateStatus(): void {
    if (!this.order || this.statusLoading) return;
    if (this.statusDraft === this.order.status) return;

    const previousStatus = this.order.status;
    this.order = { ...this.order, status: this.statusDraft };
    this.statusLoading = true;
    this.cdr.markForCheck();

    this.ordersService
      .updateOrderStatus(this.order.id, this.statusDraft)
      .subscribe({
        next: (updated) => {
          this.statusLoading = false;
          this.order = updated;
          this.statusDraft = updated.status;
          this.reloadTasks(updated.id);
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.statusLoading = false;
          this.order = { ...this.order!, status: previousStatus };
          this.statusDraft = previousStatus;
          this.cdr.markForCheck();
          alert(
            extractApiErrorMessage(err, 'No se pudo actualizar el estado'),
          );
        },
      });
  }

  openEdit(): void {
    if (!this.order) return;

    this.formDialogs.openOrder(this.order).subscribe((updated) => {
      if (!updated) return;
      this.order = updated;
      this.statusDraft = updated.status;
      this.reloadTasks(updated.id);
      this.cdr.markForCheck();
    });
  }

  deleteOrder(): void {
    if (!this.order) return;
    if (!confirm(`¿Eliminar el pedido ${this.order.id}?`)) return;

    this.ordersService.deleteOrder(this.order.id).subscribe({
      next: () => this.router.navigate(['/pedidos']),
      error: (err) => {
        alert(extractApiErrorMessage(err, 'No se pudo eliminar el pedido'));
      },
    });
  }

  private handleRealtime(event: RealtimeEvent): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;

    this.catalogSync.handleEvent(event);

    if (
      event.scope === 'orders' ||
      event.scope === 'print-jobs' ||
      event.scope === 'all' ||
      (event.entity === 'order' && event.id === id)
    ) {
      this.loadOrder(id);
    }
  }

  private reloadTasks(orderId: string): void {
    this.printJobsService.getPrintJobsByOrder(orderId).subscribe({
      next: (tasks) => {
        this.tasks = tasks;
        this.cdr.markForCheck();
      },
    });
  }
}
