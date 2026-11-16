import { NgClass } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  Output,
  ViewChild,
  inject,
} from '@angular/core';
import { LayoutUiService } from '../../layout/layout-ui.service';
import { trapTabKey } from '../../layout/focus-trap.util';
import { DbButtonComponent } from '../../components/db-button/db-button.component';

let nextModalId = 0;

export type ModalSize = 'sm' | 'md' | 'ml' | 'lg';

@Component({
  selector: 'app-form-modal',
  standalone: true,
  imports: [NgClass, DbButtonComponent],
  templateUrl: './form-modal.component.html',
  styleUrl: './form-modal.component.scss',
})
export class FormModalComponent implements AfterViewInit, OnDestroy {
  private readonly layoutUi = inject(LayoutUiService);
  private previousFocus: HTMLElement | null = null;
  private backdropMouseDown = false;

  readonly titleId = `form-modal-title-${++nextModalId}`;

  @ViewChild('panel', { static: true }) private panel?: ElementRef<HTMLElement>;

  @Input() title = '';
  @Input() subtitle = '';
  @Input() size: ModalSize = 'md';
  @Input() stickyHeader = false;
  /** Pie gris a ancho completo, como RdPatrones §1/§2. */
  @Input() footerBar = false;
  /** Confirmación: en desktop el título va dentro del cuerpo (app-confirm-lead). */
  @Input() confirm = false;
  @Output() close = new EventEmitter<void>();

  constructor() {
    const active = document.activeElement;
    this.previousFocus = active instanceof HTMLElement ? active : null;
    this.layoutUi.pushOverlay();
  }

  ngAfterViewInit(): void {
    const el = this.panel?.nativeElement;
    if (el && !el.contains(document.activeElement)) {
      el.focus({ preventScroll: true });
    }
  }

  ngOnDestroy(): void {
    this.layoutUi.popOverlay();
    const restore = this.previousFocus;
    this.previousFocus = null;
    if (restore?.isConnected) {
      queueMicrotask(() => restore.focus({ preventScroll: true }));
    }
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Tab') {
      trapTabKey(event, this.panel?.nativeElement ?? null);
      return;
    }
    if (event.key === 'Escape' && !event.defaultPrevented) {
      event.preventDefault();
      this.close.emit();
    }
  }

  onBackdropMouseDown(event: MouseEvent): void {
    this.backdropMouseDown = event.target === event.currentTarget;
  }

  onBackdropClick(event: MouseEvent): void {
    const startedOnBackdrop = this.backdropMouseDown;
    this.backdropMouseDown = false;
    if (startedOnBackdrop && event.target === event.currentTarget) {
      this.close.emit();
    }
  }

  modalClass(): Record<string, boolean> {
    return {
      modal: true,
      'modal--sm': this.size === 'sm',
      'modal--md': this.size === 'md',
      'modal--ml': this.size === 'ml',
      'modal--lg': this.size === 'lg',
      'modal--bar': this.footerBar,
      'modal--confirm': this.confirm,
    };
  }

  headerClass(): Record<string, boolean> {
    return {
      modal__header: true,
      'modal__header--sticky': this.stickyHeader,
    };
  }
}
