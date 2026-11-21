import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import {
  DbAutocompleteComponent,
  DbAutocompleteOption,
  DbButtonComponent,
  DbFormComponent,
} from '@general-components';
import { CustomerCatalogService } from '../core/services/customer-catalog.service';
import { FormDialogShellComponent } from './form-dialog-shell/form-dialog-shell.component';

export interface ChatLinkCustomerDialogData {
  /** Cliente vinculado hoy, si hay. */
  customerId?: string | null;
  /** Texto de ayuda (p. ej. «Para crear el pedido, primero vinculá el chat a un cliente»). */
  hint?: string;
}

/** Elegir el cliente al que se vincula un chat. Devuelve el id elegido. */
@Component({
  standalone: true,
  imports: [
    FormsModule,
    FormDialogShellComponent,
    DbAutocompleteComponent,
    DbButtonComponent,
    DbFormComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    db-form {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding-bottom: 24px;
      box-sizing: border-box;
      /* El cuerpo del diálogo recorta: deja lugar para la lista del autocompletar (220px). */
      min-height: 20rem;
    }

    p {
      margin: 0;
      font-size: 0.875rem;
    }
  `,
  template: `
    <app-form-dialog-shell
      title="Vincular cliente"
      size="sm"
      [footerBar]="true"
      (close)="cancel()"
    >
      <db-form>
        @if (data.hint) {
          <p>{{ data.hint }}</p>
        }
        <db-autocomplete
          label="Cliente"
          name="chatCustomerId"
          [(ngModel)]="customerId"
          placeholder="Buscar cliente por nombre o teléfono"
          [allowCreate]="false"
          [preserveCase]="true"
          [options]="options()"
        />
      </db-form>
      <db-button
        modalFooter
        label="Cancelar"
        variant="secondary"
        format="soft"
        (clicked)="cancel()"
      />
      <db-button
        modalFooter
        label="Vincular"
        variant="primary"
        format="solid"
        [disabled]="!customerId || customerId === data.customerId"
        (clicked)="confirm()"
      />
    </app-form-dialog-shell>
  `,
})
export class ChatLinkCustomerDialogComponent {
  private readonly dialogRef = inject(DialogRef<string | undefined>);
  readonly data = inject<ChatLinkCustomerDialogData>(DIALOG_DATA);

  customerId = this.data.customerId ?? '';
  readonly options = signal<DbAutocompleteOption[]>([]);

  constructor() {
    inject(CustomerCatalogService)
      .getCustomers()
      .subscribe((customers) =>
        this.options.set(
          customers.map((c) => ({
            value: c.id,
            label:
              c.company && c.company.trim() !== c.name.trim()
                ? `${c.name} - ${c.company}`
                : c.name,
            searchText: c.phone ?? '',
          })),
        ),
      );
  }

  cancel(): void {
    this.dialogRef.close(undefined);
  }

  confirm(): void {
    if (!this.customerId) return;
    this.dialogRef.close(this.customerId);
  }
}
