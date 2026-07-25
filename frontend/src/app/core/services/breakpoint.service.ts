import { Injectable, OnDestroy, signal } from '@angular/core';

export const MOBILE_BREAKPOINT_PX = 768;

@Injectable({ providedIn: 'root' })
export class BreakpointService implements OnDestroy {
  private readonly mediaQuery = window.matchMedia(
    `(max-width: ${MOBILE_BREAKPOINT_PX}px)`,
  );

  readonly isMobile = signal(this.mediaQuery.matches);

  private readonly listener = (event: MediaQueryListEvent): void => {
    this.isMobile.set(event.matches);
  };

  constructor() {
    this.mediaQuery.addEventListener('change', this.listener);
  }

  ngOnDestroy(): void {
    this.mediaQuery.removeEventListener('change', this.listener);
  }
}
