import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DialogRef } from '@angular/cdk/dialog';
import {
  DbButtonComponent,
  DbFormErrorComponent,
  DbInputComponent,
} from '@general-components';
import { SettingsService } from '../core/services/settings.service';
import { ConfirmLeadComponent } from './confirm-lead/confirm-lead.component';
import { FormDialogShellComponent } from './form-dialog-shell/form-dialog-shell.component';
import { extractApiErrorMessage } from '../shared/utils/api-error';

@Component({
  standalone: true,
  imports: [
    FormsModule,
    FormDialogShellComponent,
    ConfirmLeadComponent,
    DbFormErrorComponent,
    DbInputComponent,
    DbButtonComponent,
  ],
  template: `
    <app-form-dialog-shell
      title="Resetear base de datos"
      size="sm"
      [confirm]="true"
      (close)="cancel()"
    >
      <app-confirm-lead tone="danger" title="Resetear base de datos">
        <p>
          Esta acción borra todos los registros: pedidos, productos, clientes,
          ventas, insumos y el resto. La base quedará vacía. No se puede
          deshacer. Escribí RESETEAR e ingresá el código de confirmación.
        </p>
        <ng-container ngProjectAs="[confirmFields]">
          <db-input
            label="Escribí RESETEAR para confirmar"
            [(ngModel)]="confirmText"
            name="confirmText"
            autocomplete="off"
            [required]="true"
            placeholder="RESETEAR"
          />
          <db-input
            label="Código de confirmación"
            [(ngModel)]="resetCode"
            name="resetCode"
            type="password"
            autocomplete="new-password"
            [required]="true"
          />
          @if (error()) {
            <db-form-error>{{ error() }}</db-form-error>
          }
        </ng-container>
      </app-confirm-lead>
      <db-button
        modalFooter
        label="Cancelar"
        variant="secondary"
        format="soft"
        [disabled]="loading()"
        (clicked)="cancel()"
      />
      <db-button
        modalFooter
        label="Resetear"
        variant="delete"
        format="solid"
        extraClass="db-button--danger-solid"
        [disabled]="loading() || !resetCode.trim() || confirmText.trim() !== 'RESETEAR'"
        (clicked)="confirmReset()"
      />
    </app-form-dialog-shell>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetDatabaseDialogComponent {
  private readonly settingsService = inject(SettingsService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly dialogRef = inject(DialogRef<boolean>);

  resetCode = '';
  confirmText = '';
  loading = signal(false);
  error = signal('');

  cancel(): void {
    if (this.loading()) return;
    this.dialogRef.close();
  }

  confirmReset(): void {
    if (this.loading() || this.confirmText.trim() !== 'RESETEAR') return;

    this.loading.set(true);
    this.error.set('');
    this.cdr.markForCheck();

    this.settingsService.resetDatabase(this.resetCode.trim()).subscribe({
      next: () => {
        this.loading.set(false);
        this.dialogRef.close(true);
        window.location.reload();
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(
          extractApiErrorMessage(err, 'No se pudo resetear la base de datos'),
        );
        this.cdr.markForCheck();
      },
    });
  }
}
