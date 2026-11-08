import {
  CdkDragDrop,
  DragDropModule,
  moveItemInArray,
  transferArrayItem,
} from '@angular/cdk/drag-drop';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  DbAreaChipComponent,
  DbButtonComponent,
  MobileSheetComponent,
} from '@general-components';
import type { DbAreaChipKey } from '@general-components';
import {
  DeliveryEstimate,
  PrintJob,
  PrintJobStatus,
  PrinterCapacity,
  PrinterQueueJob,
  PrinterQueueLane,
  PrinterQueueOtherArea,
  PrinterQueueResponse,
  ServiceType,
  TaskKind,
} from '../../../../core/models';
import { serviceTypeLabel } from '../../../../shared/constants/labels';
import { designatedArea } from '../../../../shared/utils/service-type.util';
import {
  formatBusyUntilLabel,
  formatCapacityDayHeader,
  formatDecimalHours,
  formatDeliveryLine,
  formatProgressPct,
  formatScheduleRange,
  formatYmdWeekdayDdMm,
} from '../../printer-queue-format.util';

export interface PrinterAssignEvent {
  jobId: string;
  printerId: string | null | 'auto';
  position?: number;
}

export interface PrinterReplaceSupplyEvent {
  job: PrintJob;
}

@Component({
  selector: 'app-printer-lanes',
  standalone: true,
  imports: [
    DragDropModule,
    RouterLink,
    DbButtonComponent,
    DbAreaChipComponent,
    MobileSheetComponent,
  ],
  templateUrl: './printer-lanes.component.html',
  styleUrl: './printer-lanes.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrinterLanesComponent {
  @Input({ required: true }) queue!: PrinterQueueResponse;
  /** Cola sin filtrar: estado de impresora y empty por filtros. */
  @Input() fullQueue: PrinterQueueResponse | null = null;
  @Input() estimate: DeliveryEstimate | null = null;
  @Input() estimateUnavailable = false;
  @Input() capacity: PrinterCapacity | null = null;
  @Input() canMoveJob: (job: PrintJob) => boolean = () => false;
  @Input() updating = false;
  /** Compacto vertical para mobile. */
  @Input() mobile = false;

  @Output() assign = new EventEmitter<PrinterAssignEvent>();
  @Output() openDetail = new EventEmitter<PrintJob>();
  @Output() replaceSupply = new EventEmitter<PrinterReplaceSupplyEvent>();

  assignSheetJob: PrinterQueueJob | null = null;
  moveSheetJob: PrinterQueueJob | null = null;

  readonly formatDecimalHours = formatDecimalHours;
  readonly formatBusyUntilLabel = formatBusyUntilLabel;
  readonly formatCapacityDayHeader = formatCapacityDayHeader;
  readonly formatProgressPct = formatProgressPct;
  readonly formatYmdWeekdayDdMm = formatYmdWeekdayDdMm;

  get unassignedListId(): string {
    return 'printer-unassigned';
  }

  laneListId(printerId: string): string {
    return `printer-${printerId}`;
  }

  /** Fuente sin filtros para estado / empty messages. */
  private sourceLane(lane: PrinterQueueLane): PrinterQueueLane {
    return (
      this.fullQueue?.printers.find(
        (item) => item.profile.id === lane.profile.id,
      ) ?? lane
    );
  }

  laneStatus(lane: PrinterQueueLane): 'printing' | 'queued' | 'free' {
    const source = this.sourceLane(lane);
    if (source.printing) return 'printing';
    if (source.jobs.length > 0) return 'queued';
    return 'free';
  }

  laneEmptyMessage(lane: PrinterQueueLane): string {
    if (lane.jobs.length > 0) return '';
    const source = this.sourceLane(lane);
    if (source.jobs.length > 0) {
      return 'Ninguna tarea coincide con los filtros';
    }
    return 'Sin tareas en esta impresora';
  }

  amsSubtitle(lane: PrinterQueueLane): string {
    const type = lane.profile.amsType?.trim() || 'AMS';
    const names = (lane.profile.amsSlots ?? [])
      .filter((slot): slot is NonNullable<typeof slot> => !!slot)
      .map((slot) => slot.name);
    if (!names.length) return type;
    return `${type}: ${names.join(' · ')}`;
  }

  jobTitle(job: PrintJob): string {
    return job.productName;
  }

  jobMetaLine(job: PrintJob): string {
    if (!job.orderId) return 'Interna';
    const client = job.customerName?.trim() || 'Sin cliente';
    return `#${job.orderId} · ${client}`;
  }

  unassignedMeta(job: PrinterQueueJob): string {
    const base = this.jobMetaLine(job);
    const hours = formatDecimalHours(job.estimatedHours);
    return `${base} · ${hours} h`;
  }

  scheduleLabel(job: PrinterQueueJob): string {
    const schedule = job.schedule;
    if (!schedule || schedule.blocked) return '';
    const inProgress = job.status === PrintJobStatus.EN_PROCESO;
    return formatScheduleRange(schedule.start, schedule.end, inProgress);
  }

  isInProgress(job: PrinterQueueJob): boolean {
    return job.status === PrintJobStatus.EN_PROCESO;
  }

  isBlocked(job: PrinterQueueJob): boolean {
    return job.status === PrintJobStatus.BLOQUEADO || !!job.schedule?.blocked;
  }

  deliveryLine(job: PrinterQueueJob): {
    text: string;
    kind: 'normal' | 'late' | 'overdue';
  } {
    const schedule = job.schedule;
    if (schedule?.overdue) {
      const due = job.dueDate
        ? formatYmdWeekdayDdMm(job.dueDate.slice(0, 10), { short: true })
            .replace(/^[^\s]+\s/, '')
        : '';
      return {
        text: due ? `Atrasado · era el ${due}` : 'Atrasado',
        kind: 'overdue',
      };
    }
    if (!job.dueDate) return { text: '', kind: 'normal' };
    const base = formatDeliveryLine(job.dueDate.slice(0, 10));
    if (schedule?.late && schedule.readyDate) {
      return {
        text: `${base} → listo ${formatYmdWeekdayDdMm(schedule.readyDate)}`,
        kind: 'late',
      };
    }
    return { text: base, kind: 'normal' };
  }

  otherAreaLabel(area: string): string {
    if (!area) return 'Interna';
    // Backend usa TaskType.PREPARE_ORDER ('PREPARE_ORDER'), no TaskKind.
    if (area === 'PREPARE_ORDER' || area === TaskKind.PREPARE_ORDER) {
      return 'Preparar pedido';
    }
    if (area === 'impresion_3d_resina') return 'Impresión 3D · resina';
    if (area === 'impresion_diseno') return 'Impresión de diseño';
    const designated = designatedArea(area);
    if (designated) return serviceTypeLabel(designated);
    return area;
  }

  otherAreaLine(row: PrinterQueueOtherArea): string {
    return this.otherAreaTitle(row);
  }

  otherAreaTitle(row: PrinterQueueOtherArea): string {
    const label = this.otherAreaLabel(row.area);
    const tareaWord = row.count === 1 ? 'tarea' : 'tareas';
    const hours = formatDecimalHours(row.hours);
    return `${label} · ${row.count}\u00A0${tareaWord} · ${hours}\u00A0h`;
  }

  get otherAreasTaskCount(): number {
    return this.queue.otherAreas.reduce((sum, row) => sum + row.count, 0);
  }

  isPrepareOrderArea(area: string): boolean {
    return area === 'PREPARE_ORDER' || area === TaskKind.PREPARE_ORDER;
  }

  otherAreaChipKey(area: string): DbAreaChipKey {
    if (!area || this.isPrepareOrderArea(area)) return 'general';
    const designated = designatedArea(area);
    if (designated === ServiceType.ESTAMPADO) return 'estampado';
    if (designated === ServiceType.DISENO_GRAFICO) return 'diseno';
    if (designated === ServiceType.IMPRESION_3D) return 'impresion_3d';
    if (designated === ServiceType.MODELADO) return 'modelado';
    return 'general';
  }

  capacityCell(
    row: PrinterCapacity['printers'][number],
    dayIndex: number,
  ): { kind: 'empty' | 'full' | 'warn' | 'ok'; text: string } {
    const hours = row.hoursByDay[dayIndex] ?? 0;
    if (!hours) return { kind: 'empty', text: '—' };
    if (row.full[dayIndex]) return { kind: 'full', text: 'Llena' };
    const printer = this.queue.printers.find(
      (lane) => lane.profile.id === row.printerId,
    );
    const workday = printer?.profile.workHoursPerDay ?? 16;
    const label = `${formatDecimalHours(hours)} h`;
    if (hours >= workday * 0.5) return { kind: 'warn', text: label };
    return { kind: 'ok', text: label };
  }

  onCardClick(job: PrintJob): void {
    this.openDetail.emit(job);
  }

  onDrop(event: CdkDragDrop<PrinterQueueJob[]>, printerId: string | null): void {
    if (this.updating || !this.canMoveJob(event.item.data as PrintJob)) return;

    if (event.previousContainer === event.container) {
      if (event.previousIndex === event.currentIndex) return;
      moveItemInArray(
        event.container.data,
        event.previousIndex,
        event.currentIndex,
      );
      const job = event.container.data[event.currentIndex];
      this.assign.emit({
        jobId: job.id,
        printerId,
        position: event.currentIndex,
      });
      return;
    }

    const job = event.previousContainer.data[event.previousIndex];
    transferArrayItem(
      event.previousContainer.data,
      event.container.data,
      event.previousIndex,
      event.currentIndex,
    );
    this.assign.emit({
      jobId: job.id,
      printerId,
      position: event.currentIndex,
    });
  }

  moveUp(job: PrinterQueueJob, lane: PrinterQueueLane): void {
    const index = lane.jobs.findIndex((item) => item.id === job.id);
    if (index <= 0) return;
    this.assign.emit({
      jobId: job.id,
      printerId: lane.profile.id,
      position: index - 1,
    });
  }

  moveDown(job: PrinterQueueJob, lane: PrinterQueueLane): void {
    const index = lane.jobs.findIndex((item) => item.id === job.id);
    if (index < 0 || index >= lane.jobs.length - 1) return;
    this.assign.emit({
      jobId: job.id,
      printerId: lane.profile.id,
      position: index + 1,
    });
  }

  assignTo(job: PrintJob, printerId: string | null | 'auto'): void {
    this.closeSheets();
    this.assign.emit({ jobId: job.id, printerId });
  }

  openAssignSheet(job: PrinterQueueJob): void {
    this.assignSheetJob = job;
  }

  openMoveSheet(job: PrinterQueueJob): void {
    this.moveSheetJob = job;
  }

  closeSheets(): void {
    this.assignSheetJob = null;
    this.moveSheetJob = null;
  }

  otherPrinters(currentId: string): PrinterQueueLane[] {
    return this.queue.printers.filter((lane) => lane.profile.id !== currentId);
  }

  laneForJob(job: PrintJob): PrinterQueueLane | null {
    return (
      this.queue.printers.find((lane) =>
        lane.jobs.some((item) => item.id === job.id),
      ) ?? null
    );
  }

  loadPctWidth(lane: PrinterQueueLane): number {
    return Math.round(Math.min(1, Math.max(0, lane.loadPct)) * 100);
  }

  trackLane(_index: number, lane: PrinterQueueLane): string {
    return lane.profile.id;
  }

  trackJob(_index: number, job: PrintJob): string {
    return job.id;
  }
}
