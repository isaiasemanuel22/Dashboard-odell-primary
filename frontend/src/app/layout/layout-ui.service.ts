import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LayoutUiService {
  readonly navOpen = signal(false);
  readonly pageBarCount = signal(0);

  openNav(): void {
    this.navOpen.set(true);
  }

  closeNav(): void {
    this.navOpen.set(false);
  }

  registerPageBar(): void {
    this.pageBarCount.update((count) => count + 1);
  }

  unregisterPageBar(): void {
    this.pageBarCount.update((count) => Math.max(0, count - 1));
  }
}
