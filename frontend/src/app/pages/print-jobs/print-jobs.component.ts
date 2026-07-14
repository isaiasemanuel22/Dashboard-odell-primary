import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  inject,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  CdkDragDrop,
  DragDropModule,
  moveItemInArray,
  transferArrayItem,
} from '@angular/cdk/drag-drop';
import { OrderStatus, PrintJob, PrintJobStatus } from '../../core/models';
import { RealtimeEvent } from '../../core/models/realtime.model';
import { PrintJobsService } from '../../core/services/print-jobs.service';
import { RealtimeCatalogSyncService } from '../../core/services/realtime-catalog-sync.service';
import { RealtimeService } from '../../core/services/realtime.service';
import {
  DbServiceBadgeComponent,
  DbSkeletonComponent,
  DbStateMessageComponent,
  DbButtonComponent,
  PrintJobCardComponent,
} from '@general-components';
import { ORDER_STATUS_LABELS, WORK_BOARD_COLUMNS } from '../../shared/constants/labels';
import { DateShortPipe } from '../../shared/pipes/labels.pipe';
import { extractApiErrorMessage } from '../../shared/utils/api-error';
import {
  priorityTierClass,
  PRIORITY_TIER_LABELS,
} from '../../shared/utils/priority.helpers';

@Component({
  selector: 'app-print-jobs',
  standalone: true,
  imports: [
    DragDropModule,
    RouterLink,
    DateShortPipe,
    DbServiceBadgeComponent,
    DbSkeletonComponent,
    DbStateMessageComponent,
    DbButtonComponent,
    PrintJobCardComponent,
  ],
  templateUrl: './print-jobs.component.html',
  styleUrl: './print-jobs.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrintJobsComponent implements OnInit {
  private readonly printJobsService = inject(PrintJobsService);
  private readonly catalogSync = inject(RealtimeCatalogSyncService);
  private readonly realtime = inject(RealtimeService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly columns = WORK_BOARD_COLUMNS;
  readonly backlogListId = 'backlog';
  readonly priorityTierClass = priorityTierClass;
  readonly priorityLabel = PRIORITY_TIER_LABELS;
  readonly orderStatusLabels = ORDER_STATUS_LABELS;

  loading = true;
  error = '';
  updating = false;
  statusNotice = '';

  orderStatusByOrderId: Record<string, OrderStatus> = {};

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

  loadJobs(): void {
    this.loading = true;
    this.error = '';
    this.cdr.markForCheck();

    this.printJobsService.getBoard().subscribe({
      next: ({ jobs, orderStatuses }) => {
        this.orderStatusByOrderId = orderStatuses;
        this.partitionJobs(jobs);
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

    transferArrayItem(
      event.previousContainer.data,
      event.container.data,
      event.previousIndex,
      event.currentIndex,
    );

    this.persistMove(job, targetStatus, true, fromBacklog);
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
          Object.assign(job, updated);
          this.reconcileJobPlacement(job);
          this.orderStatusByOrderId[job.orderId] = updated.orderStatus;
          this.statusNotice = `Pedido ${job.orderId} → ${ORDER_STATUS_LABELS[updated.orderStatus]}`;
          this.updating = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.updating = false;
          this.cdr.markForCheck();
          alert(extractApiErrorMessage(err, 'No se pudo mover la tarea'));
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

    Object.assign(job, previous);

    this.placeJob(job);
    this.cdr.markForCheck();
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
      ...this.columns.map((column) => column.status),
    ];
  }

  private isBacklogJob(job: PrintJob): boolean {
    return job.status === PrintJobStatus.POR_HACER && !job.active;
  }

  private placeJob(job: PrintJob): void {
    if (this.isBacklogJob(job)) {
      this.backlogJobs = this.sortByPriority([...this.backlogJobs, job]);
      return;
    }
    this.boardColumns[job.status] = this.sortByPriority([
      ...this.boardColumns[job.status],
      job,
    ]);
  }

  private reconcileJobPlacement(job: PrintJob): void {
    this.backlogJobs = this.backlogJobs.filter((j) => j.id !== job.id);
    for (const status of Object.values(PrintJobStatus)) {
      this.boardColumns[status] = this.boardColumns[status].filter(
        (j) => j.id !== job.id,
      );
    }
    this.placeJob(job);
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
