import { Injectable } from '@angular/core';

export type CustomersMobileChip =
  | 'all'
  | 'revendedor'
  | 'empresa'
  | 'con_saldo';

export interface CustomersMobileListState {
  chip: CustomersMobileChip;
  search: string;
  scrollY: number;
}

@Injectable({ providedIn: 'root' })
export class CustomersMobileStateService {
  private state: CustomersMobileListState | null = null;

  save(next: CustomersMobileListState): void {
    this.state = {
      chip: next.chip,
      search: next.search,
      scrollY: next.scrollY,
    };
  }

  read(): CustomersMobileListState | null {
    if (!this.state) return null;
    return { ...this.state };
  }
}
