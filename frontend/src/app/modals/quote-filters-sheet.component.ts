import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  inject,
} from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Quote } from '../core/models';
import {
  DbButtonComponent,
  MobileChipGroupComponent,
} from '@general-components';
import {
  QuoteMobileServiceFilter,
  QuoteMobileSheetFilters,
  emptyQuoteMobileSheetFilters,
  matchesQuoteMobileSheetFilters,
  quoteServiceFilters,
} from '../shared/utils/quote.helpers';

export interface QuoteFiltersSheetData {
  filters: QuoteMobileSheetFilters;
  /** Lista ya acotada (chip + búsqueda) para el contador en vivo. */
  quotes: Quote[];
}

@Component({
  standalone: true,
  imports: [DbButtonComponent, MobileChipGroupComponent],
  templateUrl: './quote-filters-sheet.component.html',
  styleUrl: './quote-filters-sheet.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuoteFiltersSheetComponent {
  private readonly data = inject<QuoteFiltersSheetData>(DIALOG_DATA);
  private readonly dialogRef =
    inject<DialogRef<QuoteMobileSheetFilters | undefined>>(DialogRef);
  private readonly cdr = inject(ChangeDetectorRef);

  draft: QuoteMobileSheetFilters = cloneFilters(this.data.filters);

  /** Mismo orden/etiquetas que `quoteServiceFilters` de desktop. */
  readonly serviceOptions: { value: QuoteMobileServiceFilter; label: string }[] =
    quoteServiceFilters().map((filter) => ({
      value: filter.value as QuoteMobileServiceFilter,
      label: filter.label,
    }));

  get matchCount(): number {
    return this.data.quotes.filter((quote) =>
      matchesQuoteMobileSheetFilters(quote, this.draft),
    ).length;
  }

  get applyLabel(): string {
    const n = this.matchCount;
    return n === 1 ? 'Ver 1 presupuesto' : `Ver ${n} presupuestos`;
  }

  onServiceChange(value: QuoteMobileServiceFilter | null): void {
    if (value == null) return;
    this.draft = { ...this.draft, service: value };
    this.cdr.markForCheck();
  }

  clearAll(): void {
    this.draft = emptyQuoteMobileSheetFilters();
    this.cdr.markForCheck();
  }

  apply(): void {
    this.dialogRef.close(cloneFilters(this.draft));
  }

  cancel(): void {
    this.dialogRef.close(undefined);
  }
}

function cloneFilters(
  filters: QuoteMobileSheetFilters,
): QuoteMobileSheetFilters {
  return { service: filters.service };
}
