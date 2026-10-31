import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  inject,
} from '@angular/core';
import {
  CdkDragDrop,
  DragDropModule,
  moveItemInArray,
  transferArrayItem,
} from '@angular/cdk/drag-drop';
import { OrderStatus, PrintJob, PrintJobStatus, ServiceType, TaskKind } from '../../core/models';
import { RealtimeEvent } from '../../core/models/realtime.model';
import { PrintJobsService } from '../../core/services/print-jobs.service';
import { RealtimeCatalogSyncService } from '../../core/services/realtime-catalog-sync.service';
import { RealtimeService } from '../../core/services/realtime.service';
import {
  DbSkeletonComponent,
  DbStateMessageComponent,
  DbButtonComponent,
  PrintJobCardComponent,
} from '@general-components';
import {
  ORDER_STATUS_LABELS,
  PRINT_JOB_STATUS_LABELS,
  WORK_BOARD_AREA_FILTERS,
  WORK_BOARD_CANCELLED_COLUMN,
  WORK_BOARD_COLUMNS,
  WorkBoardColumnConfig,
} from '../../shared/constants/labels';
import { extractApiErrorMessage } from '../../shared/utils/api-error';
import { FormDialogService } from '../../shared/form-dialogs/public-api';
import {
  PrintJobCustomerChip,
  PrintJobsToolbarComponent,
} from './print-jobs-toolbar/print-jobs-toolbar.component';
import {
  priorityTierClass,
  PRIORITY_TIER_LABELS,
} from '../../shared/utils/priority.helpers';

@Component({
  selector: 'app-print-jobs',
  standalone: true,
  imports: [
    DragDropModule,
    DbSkeletonComponent,
    DbStateMessageComponent,
    DbButtonComponent,
    PrintJobCardComponent,
    PrintJobsToolbarComponent,
  ],
  templateUrl: './print-jobs.component.html',
  styleUrl: './print-jobs.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrintJobsComponent implements OnInit {
  private readonly printJobsService = inject(PrintJobsService);
  private readonly catalogSync = inject(RealtimeCatalogSyncService);
  private readonly realtime = inject(RealtimeService);
  private readonly formDialogs = inject(FormDialogService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly primaryColumns = WORK_BOARD_COLUMNS;
  readonly cancelledColumn = WORK_BOARD_CANCELLED_COLUMN;
  readonly areaFilters = WORK_BOARD_AREA_FILTERS;
  readonly backlogListId = 'backlog';
  readonly porHacerStatus = PrintJobStatus.POR_HACER;
  readonly doneStatus = PrintJobStatus.TERMINADO;
  readonly priorityTierClass = priorityTierClass;
  readonly priorityLabel = PRIORITY_TIER_LABELS;
  readonly orderStatusLabels = ORDER_STATUS_LABELS;

  loading = true;
  error = '';
  updating = false;
  statusNotice = '';

  searchQuery = '';
  areaFilter: ServiceType | null = null;
  customerFilter: string | null = null;

  orderStatusByOrderId: Record<string, OrderStatus> = {};
  customerChips: PrintJobCustomerChip[] = [];

  private allJobs: PrintJob[] = [];

  boardColumns: Record<PrintJobStatus, PrintJob[]> = this.emptyBoard();
  backlogJobs: PrintJob[] = [];
  connectedLists: string[] = [];

  ngOnInit(): void {
    this.loadJobs();
    this.realtime.bindSmartReload(
      this.destroyRef,
      ['print-jobs', 'orders'],
      (event) => this.handleRealtime(event),
      { skip: () => this.updating },
    );
  }

  get visibleColumns(): WorkBoardColumnConfig[] {
    if (this.boardColumns[PrintJobStatus.CANCELADO].length) {
      return [...this.primaryColumns, this.cancelledColumn];
    }
    return this.primaryColumns;
  }

  get boardColumnCount(): number {
    return this.visibleColumns.length;
  }

  get tasksOnBoardCount(): number {
    return this.visibleColumns.reduce(
      (sum, col) => sum + this.boardColumns[col.status].length,
      0,
    );
  }

  get backlogCount(): number {
    return this.backlogJobs.length;
  }

  get blockedCount(): number {
    return this.boardColumns[PrintJobStatus.BLOQUEADO].length;
  }

  columnTaskCount(status: PrintJobStatus): number {
    const onBoard = this.boardColumns[status].length;
    if (status === PrintJobStatus.POR_HACER) {
      return onBoard + this.backlogJobs.length;
    }
    return onBoard;
  }

  setAreaFilter(value: ServiceType | null): void {
    this.areaFilter = value;
    this.rebuildBoard();
  }

  toggleCustomerFilter(initial: string): void {
    this.customerFilter = this.customerFilter === initial ? null : initial;
    this.rebuildBoard();
  }

  onSearchChange(): void {
    this.rebuildBoard();
  }

  onNewTaskClick(): void {
    this.formDialogs
      .openConfirm({
        title: 'Nueva tarea',
        message:
          'Las tareas se generan al confirmar pedidos. ¿Querés ir a Pedidos para crear uno?',
        confirmLabel: 'Ir a pedidos',
        cancelLabel: 'Cerrar',
        confirmVariant: 'primary',
      })
      .subscribe((confirmed) => {
        if (confirmed) {
          window.location.assign('/pedidos');
        }
      });
  }

  loadJobs(): void {
    this.loading = true;
    this.error = '';
    this.cdr.markForCheck();

    this.printJobsService.getBoard().subscribe({
      next: ({ jobs, orderStatuses }) => {
        this.allJobs = jobs;
        this.orderStatusByOrderId = orderStatuses;
        this.customerChips = this.buildCustomerChips(jobs);
        this.rebuildBoard();
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loading = false;
        this.error = extractApiErrorMessage(err, 'No se pudo cargar la cola de trabajo');
        this.cdr.markForCheck();
      },
    });
  }

  dropOnBoard(
    event: CdkDragDrop<PrintJob[]>,
    targetStatus: PrintJobStatus,
  ): void {
    if (event.previousContainer === event.container) {
      moveItemInArray(
        event.container.data,
        event.previousIndex,
        event.currentIndex,
      );
      return;
    }

    const job = event.previousContainer.data[event.previousIndex];
    const fromBacklog = event.previousContainer.id === this.backlogListId;

    if (
      job.status === PrintJobStatus.TERMINADO &&
      targetStatus !== PrintJobStatus.TERMINADO
    ) {
      this.confirmReopenFinished(job, targetStatus, () => {
        this.applyBoardMove(event, job, targetStatus, fromBacklog);
      });
      return;
    }

    this.applyBoardMove(event, job, targetStatus, fromBacklog);
  }

  private applyBoardMove(
    event: CdkDragDrop<PrintJob[]>,
    job: PrintJob,
    targetStatus: PrintJobStatus,
    fromBacklog: boolean,
  ): void {
    transferArrayItem(
      event.previousContainer.data,
      event.container.data,
      event.previousIndex,
      event.currentIndex,
    );

    this.persistMove(job, targetStatus, true, fromBacklog);
  }

  private confirmReopenFinished(
    job: PrintJob,
    targetStatus: PrintJobStatus,
    onConfirm: () => void,
  ): void {
    const targetLabel = PRINT_JOB_STATUS_LABELS[targetStatus];

    this.formDialogs
      .openConfirm({
        title: 'Reabrir tarea terminada',
        message: `«${job.productName}» está terminada. ¿Querés moverla a «${targetLabel}»?`,
        confirmLabel: 'Sí, reabrir',
        cancelLabel: 'Cancelar',
        confirmVariant: 'primary',
      })
      .subscribe((confirmed) => {
        if (confirmed) {
          onConfirm();
        }
      });
  }

  dropOnBacklog(event: CdkDragDrop<PrintJob[]>): void {
    if (event.previousContainer === event.container) {
      moveItemInArray(
        event.container.data,
        event.previousIndex,
        event.currentIndex,
      );
      return;
    }

    const job = event.previousContainer.data[event.previousIndex];

    transferArrayItem(
      event.previousContainer.data,
      event.container.data,
      event.previousIndex,
      event.currentIndex,
    );

    this.persistMove(job, job.status, false, false);
  }

  addToBoard(job: PrintJob): void {
    if (job.active || this.updating) return;

    const targetStatus = PrintJobStatus.POR_HACER;
    this.backlogJobs = this.backlogJobs.filter((j) => j.id !== job.id);
    this.boardColumns[targetStatus] = this.sortByPriority([
      ...this.boardColumns[targetStatus],
      { ...job, active: true, status: targetStatus },
    ]);

    this.persistMove(job, targetStatus, true, true);
  }

  private handleRealtime(event: RealtimeEvent): void {
    this.catalogSync.handleEvent(event);
    this.loadJobs();
  }

  private persistMove(
    job: PrintJob,
    status: PrintJobStatus,
    active: boolean,
    fromBacklog: boolean,
  ): void {
    const previous = { ...job };
    job.active = active;
    job.status = status;

    this.updating = true;
    this.cdr.markForCheck();
    this.printJobsService
      .updatePrintJob(job.id, { status, active })
      .subscribe({
        next: (updated) => {
          this.orderStatusByOrderId[job.orderId] = updated.orderStatus;
          this.statusNotice = `Pedido ${job.orderId} → ${ORDER_STATUS_LABELS[updated.orderStatus]}`;
          this.updating = false;
          this.loadJobs();
        },
        error: (err) => {
          this.updating = false;
          this.cdr.markForCheck();
          this.formDialogs
            .openConfirm({
              title: 'No se pudo mover la tarea',
              message: extractApiErrorMessage(err, 'No se pudo mover la tarea'),
              confirmLabel: 'Entendido',
              alertOnly: true,
            })
            .subscribe();
          this.revertMove(job, previous, fromBacklog, active);
        },
      });
  }

  private revertMove(
    job: PrintJob,
    previous: PrintJob,
    fromBacklog: boolean,
    wasAddingToBoard: boolean,
  ): void {
    this.boardColumns[job.status] = this.boardColumns[job.status].filter(
      (j) => j.id !== job.id,
    );
    this.backlogJobs = this.backlogJobs.filter((j) => j.id !== job.id);

    const idx = this.allJobs.findIndex((j) => j.id === job.id);
    if (idx >= 0) {
      this.allJobs[idx] = { ...previous };
    }
    this.rebuildBoard();
  }

  private rebuildBoard(): void {
    this.partitionJobs(this.filterJobs(this.allJobs));
    this.cdr.markForCheck();
  }

  private filterJobs(jobs: PrintJob[]): PrintJob[] {
    let list = jobs;
    const query = this.searchQuery.trim().toLowerCase();

    if (query) {
      list = list.filter(
        (job) =>
          job.productName.toLowerCase().includes(query) ||
          job.orderId.toLowerCase().includes(query) ||
          job.customerName.toLowerCase().includes(query),
      );
    }

    if (this.areaFilter) {
      list = list.filter(
        (job) =>
          job.taskKind !== TaskKind.PREPARE_ORDER && job.type === this.areaFilter,
      );
    }

    if (this.customerFilter) {
      list = list.filter(
        (job) => this.customerInitial(job.customerName) === this.customerFilter,
      );
    }

    return list;
  }

  private partitionJobs(jobs: PrintJob[]): void {
    this.boardColumns = this.emptyBoard();
    this.backlogJobs = [];

    for (const job of jobs) {
      if (this.isBacklogJob(job)) {
        this.backlogJobs.push(job);
      } else {
        this.boardColumns[job.status].push(job);
      }
    }

    for (const status of Object.values(PrintJobStatus)) {
      this.boardColumns[status] = this.sortByPriority(this.boardColumns[status]);
    }
    this.backlogJobs = this.sortByPriority(this.backlogJobs);

    this.connectedLists = [
      this.backlogListId,
      ...Object.values(PrintJobStatus),
    ];
  }

  private isBacklogJob(job: PrintJob): boolean {
    return job.status === PrintJobStatus.POR_HACER && !job.active;
  }

  private buildCustomerChips(jobs: PrintJob[]): PrintJobCustomerChip[] {
    const byInitial = new Map<string, string>();
    for (const job of jobs) {
      const initial = this.customerInitial(job.customerName);
      if (!byInitial.has(initial)) {
        byInitial.set(initial, job.customerName);
      }
    }
    return [...byInitial.entries()].map(([initial, name], index) => ({
      initial,
      name,
      tone: index % 4,
    }));
  }

  private customerInitial(name: string): string {
    const trimmed = name?.trim();
    if (!trimmed) return '?';
    return trimmed.charAt(0).toUpperCase();
  }

  private emptyBoard(): Record<PrintJobStatus, PrintJob[]> {
    return {
      [PrintJobStatus.POR_HACER]: [],
      [PrintJobStatus.EN_PROCESO]: [],
      [PrintJobStatus.BLOQUEADO]: [],
      [PrintJobStatus.EN_REVISION]: [],
      [PrintJobStatus.TERMINADO]: [],
      [PrintJobStatus.CANCELADO]: [],
    };
  }

  private sortByPriority(jobs: PrintJob[]): PrintJob[] {
    return [...jobs].sort((a, b) => b.priority - a.priority);
  }
}
