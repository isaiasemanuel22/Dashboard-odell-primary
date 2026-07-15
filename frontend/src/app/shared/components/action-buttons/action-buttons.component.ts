import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'db-edit-button',
  standalone: true,
  template: `
    <button
      type="button"
      class="db-btn-edit"
      [disabled]="disabled"
      (click)="clicked.emit()"
    >
      {{ label }}
    </button>
  `,
  styleUrl: './edit-button.component.scss',
})
export class DbEditButtonComponent {
  @Input() label = 'Editar';
  @Input() disabled = false;
  @Output() clicked = new EventEmitter<void>();
}

@Component({
  selector: 'db-delete-button',
  standalone: true,
  template: `
    <button
      type="button"
      class="db-btn-delete"
      [disabled]="disabled"
      (click)="clicked.emit()"
    >
      {{ label }}
    </button>
  `,
  styleUrl: './delete-button.component.scss',
})
export class DbDeleteButtonComponent {
  @Input() label = 'Eliminar';
  @Input() disabled = false;
  @Output() clicked = new EventEmitter<void>();
}

@Component({
  selector: 'db-row-actions',
  standalone: true,
  imports: [DbEditButtonComponent, DbDeleteButtonComponent],
  template: `
    <div class="db-row-actions">
      @if (showEdit) {
        <db-edit-button
          [label]="editLabel"
          [disabled]="disabled"
          (clicked)="edit.emit()"
        />
      }
      <db-delete-button
        [label]="deleteLabel"
        [disabled]="disabled"
        (clicked)="delete.emit()"
      />
    </div>
  `,
  styleUrl: './row-actions.component.scss',
})
export class DbRowActionsComponent {
  @Input() showEdit = true;
  @Input() editLabel = 'Editar';
  @Input() deleteLabel = 'Eliminar';
  @Input() disabled = false;
  @Output() edit = new EventEmitter<void>();
  @Output() delete = new EventEmitter<void>();
}
