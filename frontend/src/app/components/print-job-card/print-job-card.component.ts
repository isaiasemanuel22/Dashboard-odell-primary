import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  OrderStatus,
  PrintJob,
  PrintJobStatus,
  ServiceType,
  TaskKind,
} from '../../core/models';
import {
  OrderStatusLabelPipe,
  PrintJobStatusLabelPipe,
} from '../../shared/pipes/labels.pipe';
import {
  priorityTierClass,
  PRIORITY_TIER_LABELS,
} from '../../shared/utils/priority.helpers';
import { DbButtonComponent } from '../db-button';
import { DbServiceBadgeComponent } from '../db-service-badge/db-service-badge.component';
import { DbStatusBadgeComponent } from '../db-status-badge/db-status-badge.component';
import { TASK_KIND_LABELS } from '../../shared/constants/labels';
import { designatedArea } from '../../shared/utils/service-type.util';
import { nameInitials } from '../../shared/utils/name-initials.util';
import { orderOverdueDays } from '../../shared/utils/order.helpers';
import { todayYmd } from '../../shared/utils/calendar-grid.util';

export type PrintJobCardVariant = 'default' | 'board';

@Component({
  selector: 'app-print-job-card',
  standalone: true,
  imports: [
    RouterLink,
    PrintJobStatusLabelPipe,
    OrderStatusLabelPipe,
    DbButtonComponent,
    DbServiceBadgeComponent,
    DbStatusBadgeComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './print-job-card.component.html',
  styleUrl: './print-job-card.component.scss',
})
export class PrintJobCardComponent {
  @Input({ required: true }) job!: PrintJob;
  /** Vista compacta para el tablero kanban (sin badge de estado). */
  @Input() compact = false;
  @Input() variant: PrintJobCardVariant = 'default';
  @Input() orderStatus?: OrderStatus;
  @Input() showReplaceSupply = false;
  @Input() showAddToBoard = false;
  @Input() addDisabled = false;
  @Output() replaceSupply = new EventEmitter<PrintJob>();
  @Output() addToBoard = new EventEmitter<PrintJob>();
  readonly taskKindLabels = TASK_KIND_LABELS;

  get priorityClass(): string {
    return priorityTierClass(this.job.priority);
  }

  get priorityLabel(): string {
    return PRIORITY_TIER_LABELS[this.priorityClass] ?? 'Normal';
  }

  get isPrepareOrder(): boolean {
    return this.job.taskKind === TaskKind.PREPARE_ORDER;
  }

  /** Null cuando la tarea no tiene área: no se inventa un badge. */
  get area(): ServiceType | null {
    return designatedArea(this.job.type);
  }

  get customerInitials(): string {
    return nameInitials(this.job.customerName);
  }

  get isOverdue(): boolean {
    if (
      this.job.status === PrintJobStatus.TERMINADO ||
      this.job.status === PrintJobStatus.CANCELADO
    ) {
      return false;
    }
    if (!this.job.dueDate) return false;
    return this.job.dueDate.slice(0, 10) < todayYmd();
  }

  get dueLabel(): { text: string; overdue: boolean } | null {
    if (!this.job.dueDate) return null;
    if (this.isOverdue) {
      const days = orderOverdueDays(
        this.job.dueDate,
        OrderStatus.EN_PROGRESO,
      );
      return {
        text: `Atrasado ${days} ${days === 1 ? 'día' : 'días'}`,
        overdue: true,
      };
    }
    return { text: this.formatEntregaShort(this.job.dueDate), overdue: false };
  }

  get stepLabel(): string {
    const kind = this.taskKindLabels[this.job.taskKind] ?? '';
    const hours = Number(this.job.estimatedHours);
    if (hours > 0) {
      const h = Number.isInteger(hours) ? String(hours) : String(hours);
      return `${kind} · ${h}\u00A0h`;
    }
    return kind;
  }

  /** «Entrega 14 nov» (día + mes corto, sin «de»). */
  private formatEntregaShort(dueDate: string): string {
    const raw = dueDate.slice(0, 10);
    const date = new Date(`${raw}T12:00:00`);
    if (Number.isNaN(date.getTime())) return 'Sin fecha';
    const day = date.getDate();
    const month = date
      .toLocaleDateString('es-AR', { month: 'short' })
      .replace(/\./g, '')
      .trim()
      .toLowerCase();
    return `Entrega ${day} ${month}`;
  }
}
