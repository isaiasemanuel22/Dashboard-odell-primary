import {
  Component,
  EventEmitter,
  HostBinding,
  Input,
  Output,
} from '@angular/core';
import { RouterLink } from '@angular/router';

export type DbButtonVariant =
  | 'primary'
  | 'primary-outline'
  | 'delete'
  | 'cancel'
  | 'secondary'
  | 'google'
  | 'inverse';
export type DbButtonFormat =
  | 'inline'
  | 'solid'
  | 'soft'
  | 'link'
  | 'icon'
  | 'filter'
  | 'overlay'
  | 'chip'
  | 'bare';
export type DbButtonType = 'button' | 'submit';

@Component({
  selector: 'db-button',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './db-button.component.html',
  styleUrl: './db-button.component.scss',
})
export class DbButtonComponent {
  @Input() label = '';
  @Input() variant: DbButtonVariant = 'primary';
  @Input() format: DbButtonFormat = 'inline';
  @Input() buttonType: DbButtonType = 'button';
  @Input() disabled = false;
  @Input() routerLink?: string | any[];
  @Input() ariaLabel = '';
  @Input() icon = '';
  @Input() active = false;
  @Input() extraClass = '';
  @Input() block = false;
  @Output() clicked = new EventEmitter<void>();

  @HostBinding('class.db-button-host--block')
  get hostBlock(): boolean {
    return this.block;
  }

  get classes(): string {
    const parts = [
      'db-button',
      `db-button--${this.variant}`,
      `db-button--${this.format}`,
    ];
    if (this.active) {
      parts.push('db-button--active');
    }
    if (this.block) {
      parts.push('db-button--block');
    }
    if (this.extraClass) {
      parts.push(this.extraClass);
    }
    return parts.join(' ');
  }

  get iconClass(): string {
    const parts = ['db-button__icon'];
    if (this.variant === 'google') {
      parts.push('db-button__icon--google');
    }
    return parts.join(' ');
  }

  onClick(event: MouseEvent): void {
    if (this.disabled) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (this.buttonType === 'submit') {
      return;
    }
    this.clicked.emit();
  }
}
