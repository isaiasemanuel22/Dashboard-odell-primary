import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { DbButtonComponent } from '@general-components';
import { ConfirmLeadComponent, ConfirmTone } from './confirm-lead/confirm-lead.component';
import { FormDialogShellComponent } from './form-dialog-shell/form-dialog-shell.component';

export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: 'primary' | 'secondary' | 'delete';
  /**
   * Ícono y color de la confirmación. Si no se indica, `delete` es «danger»
   * (ícono y botón rojos) y el resto «info».
   */
  tone?: ConfirmTone;
  /** Un solo botón, para avisos que antes salían por alert(). */
  alertOnly?: boolean;
}

@Component({
  standalone: true,
  imports: [FormDialogShellComponent, ConfirmLeadComponent, DbButtonComponent],
  template: `
    <app-form-dialog-shell
      [title]="data.title"
      size="sm"
      [confirm]="true"
      (close)="cancel()"
    >
      <app-confirm-lead [tone]="tone" [title]="data.title">
        <p>{{ data.message }}</p>
      </app-confirm-lead>
      @if (!data.alertOnly) {
        <db-button
          modalFooter
          [label]="data.cancelLabel ?? 'Cancelar'"
          variant="secondary"
          format="soft"
          (clicked)="cancel()"
        />
      }
      <db-button
        modalFooter
        [label]="data.confirmLabel ?? 'Confirmar'"
        [variant]="tone === 'danger' ? 'delete' : (data.confirmVariant ?? 'primary')"
        format="solid"
        (clicked)="confirm()"
      />
    </app-form-dialog-shell>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmDialogComponent {
  readonly data = inject<ConfirmDialogData>(DIALOG_DATA);
  private readonly dialogRef = inject(DialogRef<boolean>);

  get tone(): ConfirmTone {
    return this.data.tone ?? (this.data.confirmVariant === 'delete' ? 'danger' : 'info');
  }

  confirm(): void {
    this.dialogRef.close(true);
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}
