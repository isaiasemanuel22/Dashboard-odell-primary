import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  DbButtonComponent,
  DbStatusBadgeComponent,
} from '@general-components';
import {
  DbCheckboxComponent,
  DbInputComponent,
  DbSelectComponent,
  DbSelectOption,
  DbTextareaComponent,
} from '@dashboard-form';
import {
  PrintJob,
  PrintJobConsumptionLine,
  PrintJobFailure,
  PrintJobFailureStats,
  PrintJobStatus,
  ServiceType,
  SupplyReplacementChoice,
  TaskKind,
  UpdatePrintJobPayload,
} from '../core/models';
import { PrintJobsService } from '../core/services/print-jobs.service';
import { UserAccessService } from '../core/services/user-access.service';
import {
  FAILURE_REASON_LABELS,
  FAILURE_REASONS,
  BLOCKED_REASON_SUPPLIES,
} from '../shared/constants/print-job-failure.constants';
import {
  SERVICE_TYPE_LABELS,
  TASK_KIND_LABELS,
  serviceTypeLabel,
} from '../shared/constants/labels';
import { PrintJobStatusLabelPipe } from '../shared/pipes/labels.pipe';
import { canMovePrintJob } from '../shared/utils/can-move-print-job.util';
import { formatCurrencyArs } from '../shared/utils/currency-ars.util';
import { extractApiErrorMessage } from '../shared/utils/api-error';
import { isEligibleForPrinterQueue } from '../shared/utils/print-queue-eligible.util';
import {
  calcTaskPriority,
  priorityTierLabel,
} from '../shared/utils/priority.helpers';
import { formatDecimalHours } from '../pages/print-jobs/printer-queue-format.util';
import { formatYmdWeekdayDdMm } from '../pages/print-jobs/printer-queue-format.util';
import { formatSupplyQuantity } from '../shared/utils/supply-unit.util';
import { FormDialogShellComponent } from './form-dialog-shell/form-dialog-shell.component';
import { FormDialogService } from './form-dialog.service';

export interface TaskDetailDialogData {
  job: PrintJob;
}

export interface TaskDetailDialogResult {
  refreshed: boolean;
  stockWarnings?: string[];
  notice?: string;
}

@Component({
  standalone: true,
  imports: [
    FormsModule,
    FormDialogShellComponent,
    DbButtonComponent,
    DbInputComponent,
    DbSelectComponent,
    DbTextareaComponent,
    DbCheckboxComponent,
    DbStatusBadgeComponent,
    PrintJobStatusLabelPipe,
  ],
  templateUrl: './task-detail-dialog.component.html',
  styleUrl: './task-detail-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskDetailDialogComponent implements OnInit {
  private readonly dialogRef =
    inject(DialogRef<TaskDetailDialogResult | undefined>);
  private readonly data = inject<TaskDetailDialogData>(DIALOG_DATA);
  private readonly printJobs = inject(PrintJobsService);
  private readonly userAccess = inject(UserAccessService);
  private readonly formDialogs = inject(FormDialogService);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);

  job: PrintJob = this.data.job;
  canEdit = false;
  loading = true;
  saving = false;
  error = '';
  successNotice = '';
  private didMutate = false;
  private lastStockWarnings?: string[];

  printerId = '';
  initialPrinterId = '';
  responsibleUserId = '';
  priority: 'normal' | 'alta' = 'normal';
  actualHours: number | null = null;
  notes = '';

  failurePieces: number | null = null;
  failureGrams: number | null = null;
  failureHours: number | null = null;
  failureReason: PrintJobFailure['reason'] = 'despegue';
  failureReprint = true;

  consumption: PrintJobConsumptionLine[] = [];
  failureStats: PrintJobFailureStats | null = null;

  printerOptions: DbSelectOption[] = [{ value: '', label: 'Sin asignar' }];
  responsibleOptions: DbSelectOption[] = [
    { value: '', label: 'Sin asignar' },
  ];
  priorityOptions: DbSelectOption[] = [];
  readonly failureReasonOptions: DbSelectOption[] = FAILURE_REASONS.map(
    (value) => ({
      value,
      label: FAILURE_REASON_LABELS[value],
    }),
  );

  readonly formatCurrencyArs = formatCurrencyArs;
  readonly formatDecimalHours = formatDecimalHours;
  readonly formatSupplyQuantity = formatSupplyQuantity;
  readonly failureReasonLabel = FAILURE_REASON_LABELS;
  readonly taskKindLabels = TASK_KIND_LABELS;

  ngOnInit(): void {
    this.applyJob(this.data.job);
    this.canEdit = canMovePrintJob(
      this.job,
      this.userAccess.peekCurrentUser(),
    );
    this.loadAuxData();
  }

  get shellTitle(): string {
    return this.job.productName || 'Detalle de tarea';
  }

  get shellSubtitle(): string {
    const qty = Number(this.job.quantity) || 0;
    const unitLabel =
      qty === 1 ? '1 unidad' : `${qty > 0 ? qty : 0} unidades`;
    return `${this.taskTypeSubtitle} · ${unitLabel}${this.gramsSubtitleSuffix}`;
  }

  private get taskTypeSubtitle(): string {
    if (this.job.taskKind === TaskKind.PREPARE_ORDER) {
      return TASK_KIND_LABELS[TaskKind.PREPARE_ORDER];
    }
    if (this.job.taskKind === TaskKind.INTERNAL && !this.job.productId) {
      return 'Tarea interna';
    }
    if (this.isPrint3dTask) {
      return 'Tarea de producción';
    }
    if (this.job.type && this.job.type in SERVICE_TYPE_LABELS) {
      return `Tarea de ${serviceTypeLabel(this.job.type as ServiceType)}`;
    }
    if (this.job.taskKind === TaskKind.INTERNAL) {
      return 'Tarea interna';
    }
    return 'Tarea de producción';
  }

  private get gramsSubtitleSuffix(): string {
    const qty = Number(this.job.quantity) || 0;
    const grams = this.gramsPerUnit;
    if (grams == null || qty <= 0) return '';
    const total = Math.round(grams * qty * 10) / 10;
    return ` × ${formatDecimalHours(grams)} g = ${formatDecimalHours(total)} g`;
  }

  get taskKindLabel(): string {
    return this.taskKindLabels[this.job.taskKind] ?? '';
  }

  get isPrint3dTask(): boolean {
    return isEligibleForPrinterQueue(this.job);
  }

  get showPrinterField(): boolean {
    return this.isPrint3dTask;
  }

  get showFailureSection(): boolean {
    return this.canEdit && this.isPrint3dTask && !this.isClosed;
  }

  get showFailureStats(): boolean {
    return this.isPrint3dTask;
  }

  get showReturnToBlocked(): boolean {
    return this.canEdit && !this.isBlocked && !this.isClosed;
  }

  get isBlocked(): boolean {
    return this.job.status === PrintJobStatus.BLOQUEADO;
  }

  get isClosed(): boolean {
    return (
      this.job.status === PrintJobStatus.TERMINADO ||
      this.job.status === PrintJobStatus.CANCELADO
    );
  }

  get isSupplyBlock(): boolean {
    return (
      this.isBlocked && this.job.blockedReason === BLOCKED_REASON_SUPPLIES
    );
  }

  get deliveryLine(): string {
    const client = this.job.customerName?.trim() || 'Sin cliente';
    if (!this.job.dueDate) return client;
    return `${client} · entrega ${formatYmdWeekdayDdMm(this.job.dueDate.slice(0, 10))}`;
  }

  get estimatedHint(): string {
    const hours = Number(this.job.estimatedHours) || 0;
    return `Estimado: ${formatDecimalHours(hours)} h`;
  }

  get gramsPerUnit(): number | null {
    const qty = Number(this.job.quantity) || 0;
    if (qty <= 0) return null;
    const material = this.consumption.find(
      (line) => line.kind === 'material' && line.unit === 'g' && line.quantity > 0,
    );
    if (!material) return null;
    return Math.round((material.quantity / qty) * 10) / 10;
  }

  get mainMaterialRemaining(): PrintJobConsumptionLine | null {
    return (
      this.discountedConsumption.find(
        (line) => line.kind === 'material' && line.remaining != null,
      ) ?? null
    );
  }

  get showConsumptionCard(): boolean {
    if (this.job.consumedAt) return true;
    return this.consumption.length > 0;
  }

  get consumptionTitle(): string {
    return this.job.consumedAt
      ? 'Se descontó al terminar'
      : 'Al terminar se descuenta';
  }

  /** Líneas con insumo (las que sí se descuentan / se listan al terminar). */
  get discountedConsumption(): PrintJobConsumptionLine[] {
    return this.consumption.filter((line) => !!line.supplyId);
  }

  /** Líneas sin supplyId (gris; no cuentan como descontadas). */
  get unlinkedConsumption(): PrintJobConsumptionLine[] {
    return this.consumption.filter((line) => !line.supplyId);
  }

  get consumptionEmptyMessage(): string {
    if (this.job.consumedAt && this.discountedConsumption.length === 0) {
      return 'No había insumos para descontar';
    }
    return 'Sin descuentos previstos';
  }

  get reprintQueueLabel(): string {
    const pieces = Math.max(1, Math.round(Number(this.failurePieces) || 1));
    const pieceLabel = pieces === 1 ? 'pieza' : 'piezas';
    const printerName = this.selectedPrinterName;
    if (printerName) {
      return `Agregar la reimpresión a la cola de ${printerName} (${pieces} ${pieceLabel})`;
    }
    return `Agregar la reimpresión a la cola (${pieces} ${pieceLabel})`;
  }

  get selectedPrinterName(): string {
    const id = this.printerId;
    if (!id) return '';
    const opt = this.printerOptions.find((item) => item.value === id);
    return opt?.label ?? '';
  }

  get failures(): PrintJobFailure[] {
    return this.job.failures ?? [];
  }

  get showMarginSuggestion(): boolean {
    const stats = this.failureStats;
    if (!stats || stats.suggestedPercent == null) return false;
    return stats.suggestedPercent !== stats.errorMarginPercent;
  }

  get calculatedPriorityValue(): number {
    if (this.job.calculatedPriority != null) {
      return this.job.calculatedPriority;
    }
    return calcTaskPriority(this.job.dueDate);
  }

  cancel(): void {
    this.dialogRef.close(this.closeResult());
  }

  goToOrder(): void {
    if (!this.job.orderId) return;
    this.dialogRef.close(this.closeResult());
    void this.router.navigate(['/pedidos', this.job.orderId]);
  }

  goToSettingsMargin(): void {
    this.dialogRef.close(this.closeResult());
    void this.router.navigate(['/ajustes', 'valores-generales']);
  }

  private closeResult(): TaskDetailDialogResult | undefined {
    if (!this.didMutate) return undefined;
    return {
      refreshed: true,
      notice: this.successNotice || undefined,
      ...(this.lastStockWarnings?.length
        ? { stockWarnings: this.lastStockWarnings }
        : {}),
    };
  }

  onReplaceSupply(): void {
    this.printJobs.getSupplyShortages(this.job.id).subscribe({
      next: (report) => {
        if (!report.missing.length) {
          this.error = 'No hay insumos faltantes para reemplazar';
          this.cdr.markForCheck();
          return;
        }
        this.formDialogs.openSupplyReplacement(report).subscribe((choices) => {
          if (!choices?.length) return;
          this.applyReplacements(choices);
        });
      },
      error: (err: unknown) => {
        this.error = extractApiErrorMessage(
          err as { error?: { message?: string | string[] } },
          'No se pudo cargar los insumos faltantes',
        );
        this.cdr.markForCheck();
      },
    });
  }

  onUnblock(): void {
    if (!this.canEdit || this.saving) return;
    this.saving = true;
    this.error = '';
    this.cdr.markForCheck();
    this.printJobs
      .updatePrintJob(this.job.id, { status: PrintJobStatus.POR_HACER })
      .subscribe({
        next: (updated) => {
          this.saving = false;
          this.didMutate = true;
          this.lastStockWarnings = updated.stockWarnings;
          this.applyJob(updated);
          this.successNotice = 'Tarea desbloqueada';
          this.reloadDetail();
        },
        error: (err: unknown) => this.handleError(err, 'No se pudo desbloquear'),
      });
  }

  onReturnToBlocked(): void {
    if (!this.canEdit || this.saving || this.isBlocked || this.isClosed) {
      return;
    }
    this.formDialogs
      .openPrompt({
        title: 'Devolver a Bloqueado',
        inputLabel: 'Motivo del bloqueo',
        confirmLabel: 'Bloquear',
        confirmVariant: 'delete',
        required: true,
        maxLength: 255,
      })
      .subscribe((reason) => {
        if (!reason?.trim()) return;
        this.saving = true;
        this.error = '';
        this.cdr.markForCheck();
        this.printJobs
          .updatePrintJob(this.job.id, {
            status: PrintJobStatus.BLOQUEADO,
            blockedReason: reason.trim().slice(0, 255),
          })
          .subscribe({
            next: (updated) => {
              this.saving = false;
              this.didMutate = true;
              this.lastStockWarnings = updated.stockWarnings;
              this.applyJob(updated);
              this.successNotice = 'Tarea bloqueada';
              this.reloadDetail();
            },
            error: (err: unknown) =>
              this.handleError(err, 'No se pudo bloquear la tarea'),
          });
      });
  }

  onRegisterFailure(): void {
    if (!this.canEdit || this.saving || !this.showFailureSection) return;
    const pieces = Math.round(Number(this.failurePieces));
    const grams = Number(this.failureGrams);
    const hours = Number(this.failureHours);
    if (!Number.isInteger(pieces) || pieces < 1) {
      this.error = 'Indicá cuántas piezas fallaron';
      this.cdr.markForCheck();
      return;
    }
    this.saving = true;
    this.error = '';
    this.cdr.markForCheck();
    this.printJobs
      .registerFailure(this.job.id, {
        pieces,
        grams: Number.isFinite(grams) ? grams : 0,
        hours: Number.isFinite(hours) ? hours : 0,
        reason: this.failureReason,
        reprint: this.failureReprint,
      })
      .subscribe({
        next: (result) => {
          this.saving = false;
          this.didMutate = true;
          this.applyJob(result.job);
          this.failurePieces = null;
          this.failureGrams = null;
          this.failureHours = null;
          this.successNotice = 'Falla registrada';
          this.error = '';
          this.reloadDetail();
        },
        error: (err: unknown) =>
          this.handleError(err, 'No se pudo registrar la falla'),
      });
  }

  onSave(): void {
    if (!this.canEdit || this.saving) return;
    this.saving = true;
    this.error = '';
    this.cdr.markForCheck();

    const patch = this.buildSavePatch();
    const printerChanged =
      this.showPrinterField && this.printerId !== this.initialPrinterId;

    const saveJob$ = this.printJobs.updatePrintJob(this.job.id, patch);
    const assign$ =
      printerChanged && this.isPrint3dTask
        ? this.printJobs.assignPrinter(this.job.id, this.printerId || null)
        : of(null);

    forkJoin({ saved: saveJob$, assigned: assign$ }).subscribe({
      next: ({ saved }) => {
        this.saving = false;
        this.didMutate = true;
        this.lastStockWarnings = saved.stockWarnings;
        this.applyJob(saved);
        this.successNotice = 'Tarea guardada';
        this.dialogRef.close(this.closeResult());
      },
      error: (err: unknown) => this.handleError(err, 'No se pudo guardar'),
    });
  }

  formatFailureDate(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return date.toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private buildSavePatch(): UpdatePrintJobPayload {
    const hoursRaw = this.actualHours;
    const hoursText = `${hoursRaw ?? ''}`.trim();
    const parsedHours =
      hoursRaw === null || hoursRaw === undefined || hoursText === ''
        ? null
        : Number(hoursRaw);

    const notes = this.notes.trim().slice(0, 2000);
    const priority =
      this.priority === 'alta' || this.priority === 'normal'
        ? this.priority
        : 'normal';

    return {
      priority,
      responsibleUserId: this.responsibleUserId.trim()
        ? this.responsibleUserId.trim()
        : null,
      notes: notes.length ? notes : null,
      actualHours:
        parsedHours == null || Number.isNaN(parsedHours) ? null : parsedHours,
    };
  }

  private applyReplacements(choices: SupplyReplacementChoice[]): void {
    this.saving = true;
    this.error = '';
    this.cdr.markForCheck();
    this.printJobs
      .updatePrintJob(this.job.id, { supplyReplacements: choices })
      .subscribe({
        next: (updated) => {
          this.saving = false;
          this.didMutate = true;
          this.lastStockWarnings = updated.stockWarnings;
          this.applyJob(updated);
          this.successNotice = 'Insumo reemplazado';
          this.reloadDetail();
        },
        error: (err: unknown) =>
          this.handleError(err, 'No se pudo reemplazar el insumo'),
      });
  }

  private applyJob(job: PrintJob): void {
    this.job = job;
    this.printerId = job.printerId ?? '';
    this.initialPrinterId = job.printerId ?? '';
    this.responsibleUserId = job.responsibleUserId ?? '';
    this.priority = job.priorityOverride === 3 ? 'alta' : 'normal';
    this.actualHours =
      job.actualHours == null ? null : Number(job.actualHours);
    this.notes = job.notes ?? '';
    this.canEdit = canMovePrintJob(job, this.userAccess.peekCurrentUser());
    this.refreshPriorityOptions();
  }

  private refreshPriorityOptions(): void {
    const level = priorityTierLabel(this.calculatedPriorityValue);
    this.priorityOptions = [
      { value: 'normal', label: `Automática · ${level}` },
      { value: 'alta', label: 'Alta (fija)' },
    ];
  }

  private loadAuxData(): void {
    forkJoin({
      responsibles: this.userAccess.listOrderResponsibles().pipe(
        catchError(() => of([])),
      ),
      queue: this.printJobs.getPrinterQueue().pipe(catchError(() => of(null))),
      consumption: this.printJobs.getConsumption(this.job.id).pipe(
        catchError(() => of([] as PrintJobConsumptionLine[])),
      ),
      stats: this.isPrint3dTask
        ? this.printJobs.getFailureStats().pipe(catchError(() => of(null)))
        : of(null),
      fresh: this.printJobs.getPrintJob(this.job.id).pipe(
        catchError(() => of(this.job)),
      ),
    }).subscribe({
      next: ({ responsibles, queue, consumption, stats, fresh }) => {
        this.applyJob(fresh);
        this.responsibleOptions = [
          { value: '', label: 'Sin asignar' },
          ...responsibles.map((user) => ({
            value: user.firebaseUid,
            label: user.displayName,
          })),
        ];
        this.printerOptions = [
          { value: '', label: 'Sin asignar' },
          ...(queue?.printers.map((lane) => ({
            value: lane.profile.id,
            label: lane.profile.name,
          })) ?? []),
        ];
        this.consumption = consumption;
        this.failureStats = stats;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  /** Recarga job + fallas + consumption + failure-stats en el modal. */
  private reloadDetail(): void {
    forkJoin({
      fresh: this.printJobs.getPrintJob(this.job.id).pipe(
        catchError(() => of(this.job)),
      ),
      consumption: this.printJobs.getConsumption(this.job.id).pipe(
        catchError(() => of([] as PrintJobConsumptionLine[])),
      ),
      stats: this.isPrint3dTask
        ? this.printJobs.getFailureStats().pipe(catchError(() => of(null)))
        : of(null),
    }).subscribe(({ fresh, consumption, stats }) => {
      this.applyJob(fresh);
      this.consumption = consumption;
      this.failureStats = stats;
      this.cdr.markForCheck();
    });
  }

  private handleError(err: unknown, fallback: string): void {
    this.saving = false;
    this.error = extractApiErrorMessage(
      err as { error?: { message?: string | string[] } },
      fallback,
    );
    this.cdr.markForCheck();
  }
}
