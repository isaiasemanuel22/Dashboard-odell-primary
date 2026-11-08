import { NgClass } from '@angular/common';
import {
  Component,
  EventEmitter,
  HostBinding,
  Input,
  Output,
} from '@angular/core';
import { DbButtonComponent } from '../../components/db-button/db-button.component';
import { ModalSize } from '../modal-size';

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
  /** Pie gris a ancho completo (RdPatrones §1): estiliza el db-form-footer del formulario. */
  @Input() footerBar = false;
  /** Confirmación (RdPatrones §2): sin cabecera en desktop, pie gris con `[modalFooter]`. */
  @Input() confirm = false;
  /** Activa flex column + body scroll para dejar el slot formDialogFooter fijo. */
  @Input() stickyFooter = false;
  @Output() close = new EventEmitter<void>();

  @HostBinding('class.form-dialog-shell--sticky-footer')
  get stickyFooterClass(): boolean {
    return this.stickyFooter;
  }

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
      'modal--ml': this.size === 'ml',
      'modal--lg': this.size === 'lg',
      'modal--xl': this.size === 'xl',
      'modal--wide': this.size === 'wide',
      'modal--bar': this.footerBar || this.confirm,
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
