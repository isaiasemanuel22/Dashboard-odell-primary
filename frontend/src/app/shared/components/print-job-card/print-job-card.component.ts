import { Component, Input } from '@angular/core';
import { PrintJob } from '../../../core/models';
import {
  PrintJobStatusLabelPipe,
} from '../../pipes/labels.pipe';
import { DbServiceBadgeComponent } from '../db-service-badge/db-service-badge.component';
import { DbStatusBadgeComponent } from '../db-status-badge/db-status-badge.component';

@Component({
  selector: 'app-print-job-card',
  standalone: true,
  imports: [PrintJobStatusLabelPipe, DbServiceBadgeComponent, DbStatusBadgeComponent],
  templateUrl: './print-job-card.component.html',
  styleUrl: './print-job-card.component.scss',
})
export class PrintJobCardComponent {
  @Input({ required: true }) job!: PrintJob;
}
