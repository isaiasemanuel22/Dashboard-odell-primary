import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ServiceType } from '../../../core/models';
import { DbButtonComponent } from '@general-components';

export interface PrintJobCustomerChip {
  initial: string;
  name: string;
  tone: number;
}

@Component({
  selector: 'app-print-jobs-toolbar',
  standalone: true,
  imports: [FormsModule, DbButtonComponent],
  templateUrl: './print-jobs-toolbar.component.html',
  styleUrl: './print-jobs-toolbar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrintJobsToolbarComponent {
  @Input() tasksOnBoardCount = 0;
  @Input() backlogCount = 0;
  @Input() blockedCount = 0;
  @Input() searchQuery = '';
  @Input() areaFilters: { value: ServiceType | null; label: string }[] = [];
  @Input() areaFilter: ServiceType | null = null;
  @Input() customerChips: PrintJobCustomerChip[] = [];
  @Input() customerFilter: string | null = null;
  @Input() statusNotice = '';

  @Output() searchQueryChange = new EventEmitter<string>();
  @Output() newTask = new EventEmitter<void>();
  @Output() areaFilterChange = new EventEmitter<ServiceType | null>();
  @Output() customerFilterToggle = new EventEmitter<string>();
}
