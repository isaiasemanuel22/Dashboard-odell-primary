import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import {
  DbButtonComponent,
  DbFormComponent,
  DbFormErrorComponent,
  DbFormFooterComponent,
  DbFormGridComponent,
  DbInputComponent,
} from '@general-components';
import { Supplier } from '../core/models';
import { SuppliersService } from '../core/services/suppliers.service';
import { extractApiErrorMessage } from '../shared/utils/api-error';
import { FormDialogShellComponent } from './form-dialog-shell/form-dialog-shell.component';

export interface SupplierFormDialogData {
  supplier: Supplier | null;
}

@Component({
  standalone: true,
  imports: [
    FormsModule,
    FormDialogShellComponent,
    DbFormComponent,
    DbFormGridComponent,
    DbInputComponent,
    DbFormErrorComponent,
    DbFormFooterComponent,
    DbButtonComponent,
  ],
  template: `
    <app-form-dialog-shell
      [title]="supplier ? 'Editar proveedor' : 'Nuevo proveedor'"
      size="md"
      [footerBar]="true"
      (close)="cancel()"
    >
      <db-form>
        <form (ngSubmit)="save()" autocomplete="off">
          <db-input
            label="Nombre"
            [(ngModel)]="name"
            name="supplierName"
            [required]="true"
          />
          <db-form-grid>
            <db-input
              label="Demora en días hábiles"
              type="number"
              [(ngModel)]="leadTimeBusinessDays"
              name="supplierLead"
              [min]="0"
              [max]="60"
              step="1"
            />
            <db-input
              label="Contacto"
              [(ngModel)]="contact"
              name="supplierContact"
            />
          </db-form-grid>
          <db-input
            label="Notas"
            [(ngModel)]="notes"
            name="supplierNotes"
          />
          @if (error) {
            <db-form-error>{{ error }}</db-form-error>
          }
          <db-form-footer>
            <db-button
              label="Cancelar"
              variant="cancel"
              format="soft"
              (clicked)="cancel()"
            />
            <db-button
              [label]="loading ? 'Guardando...' : supplier ? 'Guardar' : 'Crear proveedor'"
              variant="primary"
              format="solid"
              buttonType="submit"
              [disabled]="loading || !name.trim()"
            />
          </db-form-footer>
        </form>
      </db-form>
    </app-form-dialog-shell>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupplierFormDialogComponent implements OnInit {
  private readonly suppliersService = inject(SuppliersService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly dialogRef = inject(DialogRef<Supplier | undefined>);
  private readonly data = inject<SupplierFormDialogData>(DIALOG_DATA);

  supplier: Supplier | null = null;
  name = '';
  leadTimeBusinessDays = 3;
  contact = '';
  notes = '';
  loading = false;
  error = '';

  ngOnInit(): void {
    this.supplier = this.data.supplier;
    if (this.supplier) {
      this.name = this.supplier.name;
      this.leadTimeBusinessDays = this.supplier.leadTimeBusinessDays ?? 3;
      this.contact = this.supplier.contact ?? '';
      this.notes = this.supplier.notes ?? '';
    }
  }

  save(): void {
    const name = this.name.trim();
    if (!name) {
      this.error = 'El nombre es obligatorio.';
      this.cdr.markForCheck();
      return;
    }
    this.loading = true;
    this.error = '';
    this.cdr.markForCheck();

    const payload = {
      name,
      leadTimeBusinessDays: Number(this.leadTimeBusinessDays) || 0,
      contact: this.contact.trim() || undefined,
      notes: this.notes.trim() || undefined,
    };

    const request = this.supplier
      ? this.suppliersService.update(this.supplier.id, payload)
      : this.suppliersService.create(payload);

    request.subscribe({
      next: (saved) => {
        this.loading = false;
        this.dialogRef.close(saved);
      },
      error: (err) => {
        this.loading = false;
        this.error = extractApiErrorMessage(err, 'No se pudo guardar el proveedor');
        this.cdr.markForCheck();
      },
    });
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
