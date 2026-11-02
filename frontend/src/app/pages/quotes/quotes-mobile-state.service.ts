import { Injectable } from '@angular/core';
import { QuoteMobileChip } from '../../shared/utils/quote.helpers';

export interface QuotesMobileListState {
  chip: QuoteMobileChip;
  search: string;
  scrollY: number;
}

@Injectable({ providedIn: 'root' })
export class QuotesMobileStateService {
  private state: QuotesMobileListState | null = null;

  save(next: QuotesMobileListState): void {
    this.state = {
      chip: next.chip,
      search: next.search,
      scrollY: next.scrollY,
    };
  }

  read(): QuotesMobileListState | null {
    if (!this.state) return null;
    return { ...this.state };
  }
}
