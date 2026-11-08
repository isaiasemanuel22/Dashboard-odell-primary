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
  DbFilterPanelComponent,
  DbSegmentedControlComponent,
  DbSegmentOption,
  FilterPanelGroup,
  FilterPanelValues,
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
  imports: [FormsModule, DbButtonComponent, DbSegmentedControlComponent, DbFilterPanelComponent],
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

  get panelGroups(): FilterPanelGroup[] {
    const groups: FilterPanelGroup[] = [
      {
        id: 'area',
        title: 'Área',
        options: this.areaFilters.map((f) => ({ value: f.value ?? 'all', label: f.label })),
      },
    ];
    if (this.customerChips.length) {
      groups.push({
        id: 'customer',
        title: 'Cliente',
        options: [
          { value: 'all', label: 'Todos' },
          ...this.customerChips.map((c) => ({ value: c.initial, label: c.name })),
        ],
      });
    }
    return groups;
  }

  get panelValues(): FilterPanelValues {
    return {
      area: this.areaFilter ?? 'all',
      customer: this.customerFilter ?? 'all',
    };
  }

  onPanelApply(values: FilterPanelValues): void {
    const area = values['area'] === 'all' ? null : (values['area'] as ServiceType);
    if (area !== this.areaFilter) {
      this.areaFilterChange.emit(area);
    }
    if (this.customerChips.length) {
      const customer = values['customer'] === 'all' ? null : values['customer'];
      if (customer !== this.customerFilter) {
        // El padre alterna: emitir el actual lo apaga; emitir otro lo cambia.
        this.customerFilterToggle.emit(customer ?? (this.customerFilter as string));
      }
    }
  }
}
