import { Injectable } from '@angular/core';
import {
  OrderMobileChip,
  OrderMobileSheetFilters,
} from '../../shared/utils/order.helpers';

export interface OrdersMobileListState {
  chip: OrderMobileChip;
  sheetFilters: OrderMobileSheetFilters;
  search: string;
  scrollY: number;
}

@Injectable({ providedIn: 'root' })
export class OrdersMobileStateService {
  private state: OrdersMobileListState | null = null;

  save(next: OrdersMobileListState): void {
    this.state = {
      chip: next.chip,
      search: next.search,
      scrollY: next.scrollY,
      sheetFilters: cloneSheetFilters(next.sheetFilters),
    };
  }

  read(): OrdersMobileListState | null {
    if (!this.state) return null;
    return {
      chip: this.state.chip,
      search: this.state.search,
      scrollY: this.state.scrollY,
      sheetFilters: cloneSheetFilters(this.state.sheetFilters),
    };
  }
}

function cloneSheetFilters(
  filters: OrderMobileSheetFilters,
): OrderMobileSheetFilters {
  return {
    statuses: [...filters.statuses],
    services: [...filters.services],
    delivery: filters.delivery,
    balanceOnly: filters.balanceOnly,
  };
}
