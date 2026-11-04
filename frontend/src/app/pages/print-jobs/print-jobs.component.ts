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
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  CurrentUserResponse,
  OrderStatus,
  PrintJob,
  PrintJobStatus,
  ServiceType,
  SupplyReplacementChoice,
  TaskKind,
} from '../../core/models';
import { RealtimeEvent } from '../../core/models/realtime.model';
import { PrintJobsService } from '../../core/services/print-jobs.service';
import { UserAccessService } from '../../core/services/user-access.service';
import { RealtimeCatalogSyncService } from '../../core/services/realtime-catalog-sync.service';
import { RealtimeService } from '../../core/services/realtime.service';
import {
  DbSkeletonComponent,
  DbStateMessageComponent,
  DbButtonComponent,
  DbServiceBadgeComponent,
  MobileBarComponent,
  PrintJobCardComponent,
} from '@general-components';
import {
  ORDER_STATUS_LABELS,
  PRINT_JOB_STATUS_LABELS,
  TASK_KIND_LABELS,
  WORK_BOARD_AREA_FILTERS,
  WORK_BOARD_CANCELLED_COLUMN,
  WORK_BOARD_COLUMNS,
  WorkBoardColumnConfig,
} from '../../shared/constants/labels';
import { extractApiErrorMessage } from '../../shared/utils/api-error';
import { designatedArea } from '../../shared/utils/service-type.util';
import { formatOrderMobileDeliveryLabel } from '../../shared/utils/order.helpers';
import { FormDialogService } from '../../modals/public-api';
import {
  PrintJobCustomerChip,
  PrintJobsToolbarComponent,
} from './print-jobs-toolbar/print-jobs-toolbar.component';
import {
  priorityTierClass,
  PRIORITY_TIER_LABELS,
} from '../../shared/utils/priority.helpers';
import { todayYmd } from '../../shared/utils/calendar-grid.util';

export type MobileJobActionKind = 'add' | 'move' | 'detail';

export interface MobileJobAction {
  label: string;
  primary: boolean;
  kind: MobileJobActionKind;
  targetStatus?: PrintJobStatus;
}

@Component({
  selector: 'app-print-jobs',
  standalone: true,
  imports: [
    DragDropModule,
    FormsModule,
    DbSkeletonComponent,
    DbStateMessageComponent,
    DbButtonComponent,
    DbServiceBadgeComponent,
    MobileBarComponent,
    PrintJobCardComponent,
    PrintJobsToolbarComponent,
  ],
  templateUrl: './print-jobs.component.html',
  styleUrl: './print-jobs.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrintJobsComponent implements OnInit {
  private readonly printJobsService = inject(PrintJobsService);
  private readonly userAccess = inject(UserAccessService);
  private readonly catalogSync = inject(RealtimeCatalogSyncService);
  private readonly realtime = inject(RealtimeService);
  private readonly formDialogs = inject(FormDialogService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly router = inject(Router);

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

  /** Mobile: lupa que muestra/oculta el buscador. */
  mobileSearchOpen = false;
  /** Mobile: pestaña de estado activa (columna del tablero). */
  mobileTabStatus: PrintJobStatus = PrintJobStatus.POR_HACER;

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

  /** Tareas de la pestaña mobile activa (incluye backlog en «Por hacer»). */
  get mobileTabJobs(): PrintJob[] {
    if (this.mobileTabStatus === PrintJobStatus.POR_HACER) {
      return [...this.backlogJobs, ...this.boardColumns[PrintJobStatus.POR_HACER]];
    }
    return this.boardColumns[this.mobileTabStatus] ?? [];
  }

  setMobileTab(status: PrintJobStatus): void {
    this.mobileTabStatus = status;
    this.cdr.markForCheck();
  }

  toggleMobileSearch(): void {
    this.mobileSearchOpen = !this.mobileSearchOpen;
    this.cdr.markForCheck();
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

  isBacklogJob(job: PrintJob): boolean {
    return job.status === PrintJobStatus.POR_HACER && !job.active;
  }

  isPrepareOrder(job: PrintJob): boolean {
    return job.taskKind === TaskKind.PREPARE_ORDER;
  }

  jobArea(job: PrintJob): ServiceType | null {
    return designatedArea(job.type);
  }

  isJobBlocked(job: PrintJob): boolean {
    return job.status === PrintJobStatus.BLOQUEADO;
  }

  isJobOverdue(job: PrintJob): boolean {
    if (
      job.status === PrintJobStatus.TERMINADO ||
      job.status === PrintJobStatus.CANCELADO
    ) {
      return false;
    }
    if (!job.dueDate) return false;
    const due = job.dueDate.slice(0, 10);
    return due < todayYmd();
  }

  jobPriorityBadge(job: PrintJob): string {
    if (this.isJobBlocked(job)) return 'Bloqueada';
    const tier = priorityTierClass(job.priority);
    const label = PRIORITY_TIER_LABELS[tier] ?? 'Normal';
    const overdue = this.isJobOverdue(job);
    if (tier === 'priority-high' && overdue) return 'Alta · atrasado';
    if (overdue) return `${label} · atrasado`;
    return label;
  }

  jobPriorityUrgent(job: PrintJob): boolean {
    return (
      this.isJobBlocked(job) ||
      this.isJobOverdue(job) ||
      priorityTierClass(job.priority) === 'priority-high'
    );
  }

  jobTitle(job: PrintJob): string {
    if (job.taskKind === TaskKind.PREPARE_ORDER) {
      return TASK_KIND_LABELS[TaskKind.PREPARE_ORDER];
    }
    return job.productName;
  }

  jobDetailLine(job: PrintJob): string {
    const parts: string[] = [];
    if (this.isJobBlocked(job)) {
      parts.push(job.blockedReason || 'Esperando condición operativa');
    }
    if (job.taskKind === TaskKind.PREPARE_ORDER && job.productName) {
      parts.push(job.productName);
    } else if (job.estimatedHours > 0) {
      parts.push(`${job.estimatedHours}h est.`);
    }
    return parts.join(' · ');
  }

  jobDeliveryLabel(job: PrintJob): string {
    if (!job.dueDate) return '';
    return formatOrderMobileDeliveryLabel(job.dueDate, this.isJobOverdue(job));
  }

  customerInitials(name: string): string {
    const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  }

  /** Acciones mobile que reemplazan el drag & drop + «Agregar al tablero» + detalle. */
  mobileActions(job: PrintJob): MobileJobAction[] {
    const detail: MobileJobAction = {
      label: 'Detalle',
      primary: false,
      kind: 'detail',
    };

    if (this.isBacklogJob(job)) {
      return [
        { label: 'Agregar al tablero', primary: true, kind: 'add' },
        detail,
      ];
    }

    switch (job.status) {
      case PrintJobStatus.POR_HACER:
        return [
          detail,
          {
            label:
              job.taskKind === TaskKind.PREPARE_ORDER
                ? 'Iniciar preparación'
                : 'Empezar',
            primary: true,
            kind: 'move',
            targetStatus: PrintJobStatus.EN_PROCESO,
          },
        ];
      case PrintJobStatus.EN_PROCESO:
        return [
          detail,
          {
            label: 'A revisión',
            primary: true,
            kind: 'move',
            targetStatus: PrintJobStatus.EN_REVISION,
          },
        ];
      case PrintJobStatus.EN_REVISION:
        return [
          detail,
          {
            label: 'Terminar',
            primary: true,
            kind: 'move',
            targetStatus: PrintJobStatus.TERMINADO,
          },
        ];
      case PrintJobStatus.BLOQUEADO:
        return [
          detail,
          {
            label:
              job.taskKind === TaskKind.PREPARE_ORDER
                ? 'Iniciar preparación'
                : 'Empezar',
            primary: true,
            kind: 'move',
            targetStatus: PrintJobStatus.EN_PROCESO,
          },
        ];
      default:
        return [detail];
    }
  }

  runMobileAction(job: PrintJob, action: MobileJobAction): void {
    if (this.updating) return;
    if (action.kind === 'detail') {
      void this.router.navigate(['/pedidos', job.orderId]);
      return;
    }
    if (action.kind === 'add') {
      this.addToBoard(job);
      return;
    }
    if (action.kind === 'move' && action.targetStatus) {
      this.moveJobToStatus(job, action.targetStatus);
    }
  }

  private moveJobToStatus(job: PrintJob, targetStatus: PrintJobStatus): void {
    if (job.status === targetStatus && job.active) return;

    const apply = (): void => {
      const fromBacklog = this.isBacklogJob(job);
      if (fromBacklog) {
        this.backlogJobs = this.backlogJobs.filter((j) => j.id !== job.id);
      } else {
        this.boardColumns[job.status] = this.boardColumns[job.status].filter(
          (j) => j.id !== job.id,
        );
      }
      this.boardColumns[targetStatus] = this.sortByPriority([
        ...this.boardColumns[targetStatus],
        { ...job, active: true, status: targetStatus },
      ]);
      this.persistMove(job, targetStatus, true, fromBacklog);
    };

    this.requestStatusMove(job, targetStatus, apply);
  }

  onNewTaskClick(): void {
    const open = (uid: string): void => {
      this.userAccess.listOrderResponsibles().subscribe({
        next: (responsibles) => this.openIndependentTask(responsibles, uid),
        error: () => this.openIndependentTask([], uid),
      });
    };
    const cachedUid = sessionFirebaseUid(this.userAccess.peekCurrentUser());
    if (cachedUid) {
      open(cachedUid);
      return;
    }
    this.userAccess.loadCurrentUser().subscribe({
      next: (profile) => open(sessionFirebaseUid(profile)),
      error: () => open(''),
    });
  }

  private openIndependentTask(
    responsibles: { firebaseUid: string; displayName: string; id: string; active: boolean }[],
    defaultResponsibleId: string,
  ): void {
    this.formDialogs
      .openIndependentTask({ responsibles, defaultResponsibleId })
      .subscribe((result) => {
        if (!result) return;
        this.updating = true;
        this.cdr.markForCheck();
        this.printJobsService.createIndependent(result).subscribe({
          next: () => {
            this.updating = false;
            this.loadJobs();
          },
          error: (err: unknown) => {
            this.updating = false;
            this.error = extractApiErrorMessage(
              err as { error?: { message?: string | string[] } },
            );
            this.cdr.markForCheck();
          },
        });
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

    this.requestStatusMove(job, targetStatus, () => {
      this.applyBoardMove(event, job, targetStatus, fromBacklog);
    });
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

  private offerSupplyReplacement(
    job: PrintJob,
    status: PrintJobStatus,
    active: boolean,
    fromBacklog: boolean,
  ): void {
    this.printJobsService.getSupplyShortages(job.id).subscribe({
      next: (report) => {
        if (!report.missing.length) {
          this.showMoveError('Los insumos requeridos todavía no están disponibles');
          return;
        }
        this.formDialogs.openSupplyReplacement(report).subscribe((choices) => {
          if (!choices?.length) return;
          this.persistMove(job, status, active, fromBacklog, choices);
        });
      },
      error: () => {
        this.showMoveError('No se pudo cargar los insumos faltantes');
      },
    });
  }

  private showMoveError(message: string): void {
    this.formDialogs
      .openConfirm({
        title: 'No se pudo mover la tarea',
        message,
        confirmLabel: 'Entendido',
        alertOnly: true,
      })
      .subscribe();
  }

  /**
   * Terminado y cancelado no salen de su columna sin confirmación.
   * Si el usuario cierra el diálogo, no se toca el tablero ni se persiste.
   */
  private requestStatusMove(
    job: PrintJob,
    targetStatus: PrintJobStatus,
    apply: () => void,
  ): void {
    if (
      job.status === PrintJobStatus.TERMINADO &&
      targetStatus !== PrintJobStatus.TERMINADO
    ) {
      this.confirmReopenFinished(job, targetStatus, apply);
      return;
    }

    if (
      job.status === PrintJobStatus.CANCELADO &&
      targetStatus !== PrintJobStatus.CANCELADO
    ) {
      this.confirmReturnToCirculation(job, targetStatus, apply);
      return;
    }

    apply();
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

  private confirmReturnToCirculation(
    job: PrintJob,
    targetStatus: PrintJobStatus,
    onConfirm: () => void,
  ): void {
    const targetLabel = PRINT_JOB_STATUS_LABELS[targetStatus];

    this.formDialogs
      .openConfirm({
        title: 'Volver a circulación',
        message: `«${job.productName}» está cancelada y va a volver a la cola de trabajo. ¿Querés moverla a «${targetLabel}»?`,
        confirmLabel: 'Volver a circulación',
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
    replacements?: SupplyReplacementChoice[],
  ): void {
    const previous = { ...job };
    job.active = active;
    job.status = status;

    this.updating = true;
    this.cdr.markForCheck();
    this.printJobsService
      .updatePrintJob(job.id, {
        status,
        active,
        ...(replacements ? { supplyReplacements: replacements } : {}),
      })
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
          const message = extractApiErrorMessage(err, 'No se pudo mover la tarea');
          this.revertMove(job, previous, fromBacklog, active);
          Object.assign(job, previous);
          if (
            !replacements &&
            message.includes('insumos requeridos todavía no están disponibles')
          ) {
            this.offerSupplyReplacement(job, status, active, fromBacklog);
            return;
          }
          this.showMoveError(message);
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
          job.taskKind !== TaskKind.PREPARE_ORDER &&
          designatedArea(job.type) === this.areaFilter,
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

  private buildCustomerChips(jobs: PrintJob[]): PrintJobCustomerChip[] {
    const byInitial = new Map<string, string>();
    for (const job of jobs) {
      if (!job.customerName?.trim()) continue;
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

function sessionFirebaseUid(profile: CurrentUserResponse | null): string {
  if (!profile || !('firebaseUid' in profile)) return '';
  return profile.firebaseUid ?? '';
}
