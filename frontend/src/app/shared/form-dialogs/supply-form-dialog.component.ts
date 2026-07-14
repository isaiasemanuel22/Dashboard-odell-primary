import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Supply } from '../../core/models';
import { SuppliesService } from '../../core/services/settings.service';
import { FormDialogShellComponent } from '../../components/form-dialog-shell/form-dialog-shell.component';
import { extractApiErrorMessage } from '../utils/api-error';
import { SupplyFormComponent } from '../../pages/supplies/supply-form/supply-form.component';

export interface SupplyFormDialogData {
  supply: Supply | null;
}

@Component({
  standalone: true,
  imports: [FormDialogShellComponent, SupplyFormComponent],
  template: `
    <app-form-dialog-shell
      [title]="supply ? 'Editar insumo' : 'Nuevo insumo'"
      size="md"
      (close)="cancel()"
    >
      <app-supply-form
        [supply]="supply"
        [loading]="loading"
        [error]="error"
        (save)="save($event)"
        (cancel)="cancel()"
      />
    </app-form-dialog-shell>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupplyFormDialogComponent implements OnInit {
  private readonly suppliesService = inject(SuppliesService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly dialogRef = inject(DialogRef<Supply>);
  private readonly data = inject<SupplyFormDialogData>(DIALOG_DATA);

  supply: Supply | null = null;
  loading = false;
  error = '';

  ngOnInit(): void {
    this.supply = this.data.supply;
  }

  save(data: Partial<Supply>): void {
    this.loading = true;
    this.error = '';
    this.cdr.markForCheck();

    const request = this.supply
      ? this.suppliesService.updateSupply(this.supply.id, data)
      : this.suppliesService.createSupply(
          data as Omit<Supply, 'id' | 'updatedAt'>,
        );

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
