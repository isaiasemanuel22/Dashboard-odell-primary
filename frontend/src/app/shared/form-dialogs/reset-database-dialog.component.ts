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
  DbFormComponent,
  DbFormErrorComponent,
  DbInputComponent,
} from '@general-components';
import { SettingsService } from '../../core/services/settings.service';
import { FormDialogShellComponent } from '../../components/form-dialog-shell/form-dialog-shell.component';
import { extractApiErrorMessage } from '../utils/api-error';

@Component({
  standalone: true,
  imports: [
    FormsModule,
    FormDialogShellComponent,
    DbFormComponent,
    DbFormErrorComponent,
    DbInputComponent,
    DbButtonComponent,
  ],
  template: `
    <app-form-dialog-shell
      title="Resetear base de datos"
      size="sm"
      (close)="cancel()"
    >
      <db-form>
        <p class="reset-hint">
          Esta acción borra todos los registros: pedidos, productos, clientes,
          ventas, insumos y el resto. La base quedará vacía. Ingresá el código de
          confirmación.
        </p>

        <db-input
          label="Código de confirmación"
          [(ngModel)]="resetCode"
          name="resetCode"
          type="password"
          autocomplete="off"
          [required]="true"
          placeholder="•••••"
        />

        @if (error()) {
          <db-form-error>{{ error() }}</db-form-error>
        }

        <div class="reset-actions">
          <db-button
            label="Cancelar"
            variant="secondary"
            format="soft"
            [disabled]="loading()"
            (clicked)="cancel()"
          />
          <db-button
            label="Resetear"
            variant="delete"
            format="solid"
            [disabled]="loading() || !resetCode.trim()"
            (clicked)="confirmReset()"
          />
        </div>
      </db-form>
    </app-form-dialog-shell>
  `,
  styles: `
    .reset-hint {
      margin: 0;
      font-size: 0.9rem;
      color: var(--color-text-muted, #64748b);
      line-height: 1.5;
    }

    .reset-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      margin-top: 0.5rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetDatabaseDialogComponent {
  private readonly settingsService = inject(SettingsService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly dialogRef = inject(DialogRef<boolean>);

  resetCode = '';
  loading = signal(false);
  error = signal('');

  cancel(): void {
    if (this.loading()) return;
    this.dialogRef.close();
  }

  confirmReset(): void {
    if (this.loading()) return;

    if (
      !confirm(
        '¿Vaciar la base de datos? Se borrarán todos los registros y no quedará ningún dato.',
      )
    ) {
      return;
    }

    this.loading.set(true);
    this.error.set('');
    this.cdr.markForCheck();

    this.settingsService.resetDatabase(this.resetCode.trim()).subscribe({
      next: () => {
        this.loading.set(false);
        this.dialogRef.close(true);
        alert('Base de datos vaciada.');
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
