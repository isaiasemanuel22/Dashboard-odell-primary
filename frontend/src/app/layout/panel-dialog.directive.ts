import {
  AfterViewInit,
  Directive,
  ElementRef,
  EventEmitter,
  HostListener,
  OnDestroy,
  Output,
  inject,
} from '@angular/core';
import { trapTabKey } from './focus-trap.util';

/**
 * Paneles propios (role="dialog") que no usan db-mobile-sheet: foco inicial en
 * el panel, Esc que avisa, Tab contenido y foco devuelto a quien lo abrió.
 */
@Directive({
  selector: '[appPanelDialog]',
  standalone: true,
})
export class PanelDialogDirective implements AfterViewInit, OnDestroy {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private previousFocus: HTMLElement | null = null;

  @Output() readonly panelEscape = new EventEmitter<void>();

  constructor() {
    const active = document.activeElement;
    this.previousFocus = active instanceof HTMLElement ? active : null;
  }

  ngAfterViewInit(): void {
    const el = this.host.nativeElement;
    if (!el.contains(document.activeElement)) {
      el.focus({ preventScroll: true });
    }
  }

  ngOnDestroy(): void {
    const restore = this.previousFocus;
    this.previousFocus = null;
    if (restore?.isConnected) {
      queueMicrotask(() => restore.focus({ preventScroll: true }));
    }
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Tab') {
      trapTabKey(event, this.host.nativeElement);
      return;
    }
    if (event.key === 'Escape' && !event.defaultPrevented) {
      event.preventDefault();
      this.panelEscape.emit();
    }
  }
}
