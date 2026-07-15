import { Component, EventEmitter, Input, Output } from '@angular/core';

export type DbButtonVariant = 'primary' | 'delete' | 'cancel' | 'secondary';
export type DbButtonFormat = 'inline' | 'solid';

@Component({
  selector: 'db-button',
  standalone: true,
  template: `
    <button
      type="button"
      [class]="classes"
      [disabled]="disabled"
      (click)="clicked.emit()"
    >
      {{ label }}
    </button>
  `,
  styleUrl: './db-button.component.scss',
})
export class DbButtonComponent {
  @Input() label = '';
  @Input() variant: DbButtonVariant = 'primary';
  @Input() format: DbButtonFormat = 'inline';
  @Input() disabled = false;
  @Output() clicked = new EventEmitter<void>();

  get classes(): string {
    return `db-button db-button--${this.variant} db-button--${this.format}`;
  }
}
