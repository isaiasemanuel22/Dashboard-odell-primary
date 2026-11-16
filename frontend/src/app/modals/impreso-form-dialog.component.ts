import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import {
  CreateImpresoPayload,
  ImpresoWithCost,
} from '../core/models';
import { ImpresosService } from '../core/services/impresos.service';
import { confirmMobileFormDiscard } from '../components/mobile-form-shell/confirm-mobile-form-discard';
import { FormDialogService } from './form-dialog.service';
import { guardDialogDismiss } from './dialog-dismiss-guard';
import { FormDialogShellComponent } from './form-dialog-shell/form-dialog-shell.component';
import { extractApiErrorMessage } from '../shared/utils/api-error';
import { ImpresoFormComponent } from '../pages/settings/impresos-settings/impreso-form/impreso-form.component';

export interface ImpresoFormDialogData {
  impreso: ImpresoWithCost | null;
}

@Component({
  standalone: true,
  imports: [FormDialogShellComponent, ImpresoFormComponent],
  template: `
    <app-form-dialog-shell
      [title]="impreso ? 'Editar impreso' : 'Nuevo impreso'"
      size="ml"
      [footerBar]="true"
      (close)="cancel()"
    >
      <app-impreso-form
        #impresoForm
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
  private readonly formDialogs = inject(FormDialogService);
  private readonly destroyRef = inject(DestroyRef);
  private confirmingDiscard = false;

  @ViewChild('impresoForm') impresoForm?: ImpresoFormComponent;

  impreso: ImpresoWithCost | null = null;
  loading = false;
  error = '';

  ngOnInit(): void {
    this.impreso = this.data.impreso;
    guardDialogDismiss(this.dialogRef, this.destroyRef, () => this.cancel());
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
    if (this.confirmingDiscard || this.loading) return;
    this.confirmingDiscard = true;
    confirmMobileFormDiscard(this.formDialogs, {
      hasChanges: !!this.impresoForm?.hasUnsavedChanges(),
      entityLabel: 'el impreso',
    }).subscribe((confirmed) => {
      this.confirmingDiscard = false;
      if (confirmed) this.dialogRef.close();
    });
  }
}
