import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  DbButtonComponent,
  DbSegmentedControlComponent,
  DbSegmentOption,
} from '@general-components';
import { ServiceType } from '../../../core/models';

export interface PrintJobCustomerChip {
  initial: string;
  name: string;
  tone: number;
}

export type PrintJobsViewMode = 'status' | 'printer';

@Component({
  selector: 'app-print-jobs-toolbar',
  standalone: true,
  imports: [FormsModule, DbButtonComponent, DbSegmentedControlComponent],
  templateUrl: './print-jobs-toolbar.component.html',
  styleUrl: './print-jobs-toolbar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrintJobsToolbarComponent {
  @Input() tasksOnBoardCount = 0;
  @Input() backlogCount = 0;
  @Input() blockedCount = 0;
  @Input() queuedPrintHours = 0;
  @Input() unassignedCount = 0;
  @Input() searchQuery = '';
  @Input() areaFilters: { value: ServiceType | null; label: string }[] = [];
  @Input() areaFilter: ServiceType | null = null;
  @Input() customerChips: PrintJobCustomerChip[] = [];
  @Input() customerFilter: string | null = null;
  @Input() statusNotice = '';
  @Input() viewMode: PrintJobsViewMode = 'status';

  @Output() searchQueryChange = new EventEmitter<string>();
  @Output() newTask = new EventEmitter<void>();
  @Output() areaFilterChange = new EventEmitter<ServiceType | null>();
  @Output() customerFilterToggle = new EventEmitter<string>();
  @Output() viewModeChange = new EventEmitter<PrintJobsViewMode>();

  readonly viewOptions: DbSegmentOption<PrintJobsViewMode>[] = [
    { value: 'status', label: 'Por estado' },
    { value: 'printer', label: 'Por impresora' },
  ];

  get queuedPrintHoursLabel(): string {
    const n = Number(this.queuedPrintHours) || 0;
    return n.toLocaleString('es-AR', {
      maximumFractionDigits: 1,
      minimumFractionDigits: 0,
    });
  }
}
