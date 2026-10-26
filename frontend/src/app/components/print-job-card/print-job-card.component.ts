import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { OrderStatus, PrintJob } from '../../core/models';
import {
  OrderStatusLabelPipe,
  PrintJobStatusLabelPipe,
} from '../../shared/pipes/labels.pipe';
import {
  priorityTierClass,
  PRIORITY_TIER_LABELS,
} from '../../shared/utils/priority.helpers';
import { DbServiceBadgeComponent } from '../db-service-badge/db-service-badge.component';
import { DbStatusBadgeComponent } from '../db-status-badge/db-status-badge.component';
import { TASK_KIND_LABELS } from '../../shared/constants/labels';

export type PrintJobCardVariant = 'default' | 'board';

@Component({
  selector: 'app-print-job-card',
  standalone: true,
  imports: [
    RouterLink,
    PrintJobStatusLabelPipe,
    OrderStatusLabelPipe,
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
  readonly taskKindLabels = TASK_KIND_LABELS;

  get priorityClass(): string {
    return priorityTierClass(this.job.priority);
  }

  get priorityLabel(): string {
    return PRIORITY_TIER_LABELS[this.priorityClass] ?? 'Normal';
  }

  get customerInitial(): string {
    const name = this.job.customerName?.trim();
    if (!name) return '?';
    return name.charAt(0).toUpperCase();
  }
}
