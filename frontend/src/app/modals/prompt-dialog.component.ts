import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { DbButtonComponent } from '@general-components';
import { DbInputComponent } from '@dashboard-form';
import { FormDialogShellComponent } from './form-dialog-shell/form-dialog-shell.component';

export interface PromptDialogData {
  title: string;
  message?: string;
  inputLabel: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: 'primary' | 'secondary' | 'delete';
  required?: boolean;
  maxLength?: number;
  placeholder?: string;
}

@Component({
  standalone: true,
  imports: [
    FormsModule,
    FormDialogShellComponent,
    DbButtonComponent,
    DbInputComponent,
  ],
  template: `
    <app-form-dialog-shell [title]="data.title" size="sm" (close)="cancel()">
      @if (data.message) {
        <p class="prompt-message">{{ data.message }}</p>
      }
      <db-input
        [label]="data.inputLabel"
        name="promptValue"
        [(ngModel)]="value"
        [required]="data.required !== false"
        [placeholder]="data.placeholder ?? ''"
      />
      <div class="prompt-actions">
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
          [disabled]="!canConfirm"
          (clicked)="confirm()"
        />
      </div>
    </app-form-dialog-shell>
  `,
  styles: `
    .prompt-message {
      margin: 0 0 1rem;
      font-size: 0.95rem;
      line-height: 1.5;
      color: var(--color-text, #0f172a);
    }

    .prompt-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      margin-top: 1.25rem;
    }

    .prompt-actions ::ng-deep .db-button {
      white-space: nowrap;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PromptDialogComponent {
  readonly data = inject<PromptDialogData>(DIALOG_DATA);
  private readonly dialogRef = inject(DialogRef<string | undefined>);

  value = '';

  get canConfirm(): boolean {
    if (this.data.required === false) return true;
    const trimmed = this.value.trim();
    if (!trimmed) return false;
    const max = this.data.maxLength;
    if (max != null && trimmed.length > max) return false;
    return true;
  }

  confirm(): void {
    if (!this.canConfirm) return;
    let next = this.value.trim();
    const max = this.data.maxLength;
    if (max != null) next = next.slice(0, max);
    this.dialogRef.close(next);
  }

  cancel(): void {
    this.dialogRef.close(undefined);
  }
}
