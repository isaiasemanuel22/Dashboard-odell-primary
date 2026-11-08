import { NgClass } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { DbButtonComponent } from '../../components/db-button/db-button.component';

export type ModalSize = 'sm' | 'md' | 'ml' | 'lg';

@Component({
  selector: 'app-form-modal',
  standalone: true,
  imports: [NgClass, DbButtonComponent],
  templateUrl: './form-modal.component.html',
  styleUrl: './form-modal.component.scss',
})
export class FormModalComponent {
  @Input() title = '';
  @Input() subtitle = '';
  @Input() size: ModalSize = 'md';
  @Input() stickyHeader = false;
  /** Pie gris a ancho completo, como RdPatrones §1/§2. */
  @Input() footerBar = false;
  /** Confirmación: en desktop el título va dentro del cuerpo (app-confirm-lead). */
  @Input() confirm = false;
  @Output() close = new EventEmitter<void>();

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
