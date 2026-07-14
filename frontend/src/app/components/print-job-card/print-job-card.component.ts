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
  @Input() orderStatus?: OrderStatus;

  get priorityClass(): string {
    return priorityTierClass(this.job.priority);
  }

  get priorityLabel(): string {
    return PRIORITY_TIER_LABELS[this.priorityClass] ?? 'Normal';
  }
}
