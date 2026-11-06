import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LayoutUiService {
  readonly navOpen = signal(false);
  readonly pageBarCount = signal(0);
  /** Hojas / overlays de página que deben ocultar el menú inferior mobile. */
  readonly overlayCount = signal(0);

  private bodyScrollLockDepth = 0;
  private previousHtmlOverflow = '';
  private previousBodyOverflow = '';
  private previousBodyTouchAction = '';
  private wheelBlocker: ((event: WheelEvent) => void) | null = null;
  private touchMoveBlocker: ((event: TouchEvent) => void) | null = null;

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

  pushOverlay(): void {
    this.overlayCount.update((count) => count + 1);
    this.lockBodyScroll();
  }

  popOverlay(): void {
    this.overlayCount.update((count) => Math.max(0, count - 1));
    this.unlockBodyScroll();
  }

  /** Bloqueo de scroll del fondo (hojas / diálogos mobile). */
  lockBodyScroll(): void {
    if (typeof document === 'undefined') return;
    this.bodyScrollLockDepth += 1;
    if (this.bodyScrollLockDepth > 1) return;

    const html = document.documentElement;
    const body = document.body;
    this.previousHtmlOverflow = html.style.overflow;
    this.previousBodyOverflow = body.style.overflow;
    this.previousBodyTouchAction = body.style.touchAction;
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    body.style.touchAction = 'none';

    this.wheelBlocker = (event: WheelEvent) => {
      if (this.isInsideOverlaySurface(event.target)) return;
      event.preventDefault();
    };
    this.touchMoveBlocker = (event: TouchEvent) => {
      if (this.isInsideOverlaySurface(event.target)) return;
      event.preventDefault();
    };
    document.addEventListener('wheel', this.wheelBlocker, { passive: false });
    document.addEventListener('touchmove', this.touchMoveBlocker, {
      passive: false,
    });
  }

  unlockBodyScroll(): void {
    if (typeof document === 'undefined') return;
    if (this.bodyScrollLockDepth === 0) return;
    this.bodyScrollLockDepth -= 1;
    if (this.bodyScrollLockDepth > 0) return;

    const html = document.documentElement;
    const body = document.body;
    html.style.overflow = this.previousHtmlOverflow;
    body.style.overflow = this.previousBodyOverflow;
    body.style.touchAction = this.previousBodyTouchAction;
    this.previousHtmlOverflow = '';
    this.previousBodyOverflow = '';
    this.previousBodyTouchAction = '';

    if (this.wheelBlocker) {
      document.removeEventListener('wheel', this.wheelBlocker);
      this.wheelBlocker = null;
    }
    if (this.touchMoveBlocker) {
      document.removeEventListener('touchmove', this.touchMoveBlocker);
      this.touchMoveBlocker = null;
    }
  }

  private isInsideOverlaySurface(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) return false;
    return !!target.closest(
      '.m-sheet, .m-sheet-body, .modal, .cdk-overlay-pane, .cdk-overlay-container',
    );
  }
}
