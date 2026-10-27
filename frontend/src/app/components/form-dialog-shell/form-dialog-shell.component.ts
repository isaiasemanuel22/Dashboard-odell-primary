import { NgClass } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { DbButtonComponent } from '../db-button/db-button.component';
import { ModalSize } from '../../shared/form-dialogs/modal-size';

@Component({
  selector: 'app-form-dialog-shell',
  standalone: true,
  imports: [NgClass, DbButtonComponent],
  templateUrl: './form-dialog-shell.component.html',
  styleUrl: './form-dialog-shell.component.scss',
})
export class FormDialogShellComponent {
  @Input() title = '';
  @Input() subtitle = '';
  @Input() size: ModalSize = 'md';
  @Input() stickyHeader = false;
  @Output() close = new EventEmitter<void>();

  /** Resalta el * del subtítulo en rojo, como en los mocks de formularios. */
  get subtitleWithRequiredMark(): string {
    if (!this.subtitle) {
      return '';
    }
    return this.subtitle.replace(
      /\*/g,
      '<span class="modal__required-mark">*</span>',
    );
  }

  modalClass(): Record<string, boolean> {
    return {
      modal: true,
      'modal--sm': this.size === 'sm',
      'modal--md': this.size === 'md',
      'modal--lg': this.size === 'lg',
      'modal--xl': this.size === 'xl',
    };
  }

  headerClass(): Record<string, boolean> {
    return {
      modal__header: true,
      'modal__header--sticky': this.stickyHeader,
    };
  }
}
