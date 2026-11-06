import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  inject,
} from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import {
  DbButtonComponent,
  MobileChipGroupComponent,
} from '@general-components';

export interface PrintJobCustomerFilterOption {
  initial: string;
  name: string;
  count: number;
}

export interface PrintJobFiltersSheetData {
  customerFilter: string | null;
  customers: PrintJobCustomerFilterOption[];
  /** Cantidad total sin filtro de cliente (misma búsqueda/área). */
  totalCount: number;
}

export interface PrintJobMobileSheetFilters {
  customerFilter: string | null;
}

@Component({
  standalone: true,
  imports: [DbButtonComponent, MobileChipGroupComponent],
  templateUrl: './print-job-filters-sheet.component.html',
  styleUrl: './print-job-filters-sheet.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrintJobFiltersSheetComponent {
  private readonly data = inject<PrintJobFiltersSheetData>(DIALOG_DATA);
  private readonly dialogRef =
    inject<DialogRef<PrintJobMobileSheetFilters | undefined>>(DialogRef);
  private readonly cdr = inject(ChangeDetectorRef);

  draft: string | null = this.data.customerFilter;

  readonly customerOptions = this.data.customers.map((customer) => ({
    value: customer.initial,
    label: customer.name,
    count: customer.count,
  }));

  get matchCount(): number {
    if (!this.draft) return this.data.totalCount;
    const found = this.data.customers.find((c) => c.initial === this.draft);
    return found?.count ?? 0;
  }

  get applyLabel(): string {
    const n = this.matchCount;
    return n === 1 ? 'Ver 1 tarea' : `Ver ${n} tareas`;
  }

  onCustomerChange(value: string | null): void {
    this.draft = value;
    this.cdr.markForCheck();
  }

  clearAll(): void {
    this.draft = null;
    this.cdr.markForCheck();
  }

  apply(): void {
    this.dialogRef.close({ customerFilter: this.draft });
  }

  cancel(): void {
    this.dialogRef.close(undefined);
  }
}

export function countPrintJobMobileFilters(customerFilter: string | null): number {
  return customerFilter ? 1 : 0;
}
