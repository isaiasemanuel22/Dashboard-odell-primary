import { NgClass } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

export type ModalSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'app-form-modal',
  standalone: true,
  imports: [NgClass],
  templateUrl: './form-modal.component.html',
  styleUrl: './form-modal.component.scss',
})
export class FormModalComponent {
  @Input() title = '';
  @Input() size: ModalSize = 'md';
  @Input() stickyHeader = false;
  @Output() close = new EventEmitter<void>();

  modalClass(): Record<string, boolean> {
    return {
      modal: true,
      'modal--sm': this.size === 'sm',
      'modal--md': this.size === 'md',
      'modal--lg': this.size === 'lg',
    };
  }

  headerClass(): Record<string, boolean> {
    return {
      modal__header: true,
      'modal__header--sticky': this.stickyHeader,
    };
  }
}
