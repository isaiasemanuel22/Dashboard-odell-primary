import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import {
  CreateImpresoPayload,
  ImpresoWithCost,
} from '../../core/models';
import { ImpresosService } from '../../core/services/impresos.service';
import { FormDialogShellComponent } from '../../components/form-dialog-shell/form-dialog-shell.component';
import { extractApiErrorMessage } from '../utils/api-error';
import { ImpresoFormComponent } from '../../pages/settings/impresos-settings/impreso-form/impreso-form.component';

export interface ImpresoFormDialogData {
  impreso: ImpresoWithCost | null;
}

@Component({
  standalone: true,
  imports: [FormDialogShellComponent, ImpresoFormComponent],
  template: `
    <app-form-dialog-shell
      [title]="impreso ? 'Editar impreso' : 'Nuevo impreso'"
      size="md"
      (close)="cancel()"
    >
      <app-impreso-form
        [impreso]="impreso"
        [loading]="loading"
        [error]="error"
        (save)="save($event)"
        (cancel)="cancel()"
      />
    </app-form-dialog-shell>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImpresoFormDialogComponent implements OnInit {
  private readonly impresosService = inject(ImpresosService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly dialogRef = inject(DialogRef<ImpresoWithCost>);
  private readonly data = inject<ImpresoFormDialogData>(DIALOG_DATA);

  impreso: ImpresoWithCost | null = null;
  loading = false;
  error = '';

  ngOnInit(): void {
    this.impreso = this.data.impreso;
  }

  save(payload: CreateImpresoPayload): void {
    this.loading = true;
    this.error = '';
    this.cdr.markForCheck();

    const request = this.impreso
      ? this.impresosService.updateImpreso(this.impreso.id, payload)
      : this.impresosService.createImpreso(payload);

    request.subscribe({
      next: (saved) => {
        this.loading = false;
        this.dialogRef.close(saved);
      },
      error: (err) => {
        this.loading = false;
        this.error = extractApiErrorMessage(err, 'Error al guardar');
        this.cdr.markForCheck();
      },
    });
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
