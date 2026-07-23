import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { DbButtonComponent } from '@general-components';
import { FormDialogShellComponent } from '../../components/form-dialog-shell/form-dialog-shell.component';

export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: 'primary' | 'secondary' | 'delete';
}

@Component({
  standalone: true,
  imports: [FormDialogShellComponent, DbButtonComponent],
  template: `
    <app-form-dialog-shell [title]="data.title" size="sm" (close)="cancel()">
      <p class="confirm-message">{{ data.message }}</p>
      <div class="confirm-actions">
        <db-button
          [label]="data.cancelLabel ?? 'Cancelar'"
          variant="secondary"
          format="soft"
          (clicked)="cancel()"
        />
        <db-button
          [label]="data.confirmLabel ?? 'Confirmar'"
          [variant]="data.confirmVariant ?? 'primary'"
          format="solid"
          (clicked)="confirm()"
        />
      </div>
    </app-form-dialog-shell>
  `,
  styles: `
    .confirm-message {
      margin: 0 0 1.25rem;
      font-size: 0.95rem;
      line-height: 1.5;
      color: var(--color-text, #0f172a);
    }

    .confirm-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmDialogComponent {
  readonly data = inject<ConfirmDialogData>(DIALOG_DATA);
  private readonly dialogRef = inject(DialogRef<boolean>);

  confirm(): void {
    this.dialogRef.close(true);
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}
