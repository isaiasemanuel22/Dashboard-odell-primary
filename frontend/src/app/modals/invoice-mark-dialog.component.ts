import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { DbButtonComponent } from '@general-components';
import { DbInputComponent } from '@dashboard-form';
import { FormDialogShellComponent } from './form-dialog-shell/form-dialog-shell.component';

export interface InvoiceMarkDialogData {
  /** Venta a la que se le marca la factura (para el título). */
  saleLabel: string;
  /** Punto de venta de Integraciones; `null` si no está cargado. */
  pointOfSale: number | null;
}

export interface InvoiceMarkDialogResult {
  /** «0003-00000041» */
  number: string;
  /** ISO; fecha de emisión elegida. */
  issuedAt: string;
}

function todayYmd(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
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
    <app-form-dialog-shell
      [title]="'Marcar facturada · ' + data.saleLabel"
      size="sm"
      (close)="cancel()"
    >
      <p class="invoice-dialog__hint">
        Factura C emitida por fuera de Odell. Cargá el número tal como figura en
        el comprobante.
      </p>
      <div class="invoice-dialog__row">
        <db-input
          label="Punto de venta"
          name="invoicePos"
          inputmode="numeric"
          placeholder="0003"
          [required]="true"
          [(ngModel)]="pointOfSale"
        />
        <db-input
          label="Número"
          name="invoiceNumber"
          inputmode="numeric"
          placeholder="00000041"
          [required]="true"
          [(ngModel)]="number"
        />
      </div>
      <db-input
        label="Fecha de emisión"
        name="invoiceDate"
        type="date"
        [required]="true"
        [(ngModel)]="issuedAt"
      />
      @if (error) {
        <p class="invoice-dialog__error" role="alert">{{ error }}</p>
      }
      <div class="invoice-dialog__actions">
        <db-button
          label="Cancelar"
          variant="secondary"
          format="soft"
          (clicked)="cancel()"
        />
        <db-button
          label="Marcar facturada"
          variant="primary"
          format="solid"
          [disabled]="!canConfirm"
          (clicked)="confirm()"
        />
      </div>
    </app-form-dialog-shell>
  `,
  styles: `
    .invoice-dialog__hint {
      margin: 0 0 1rem;
      font-size: 0.9rem;
      line-height: 1.5;
      color: var(--color-text-muted, #5b7083);
    }

    .invoice-dialog__row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.75rem;
      margin-bottom: 0.75rem;
    }

    .invoice-dialog__error {
      margin: 0.75rem 0 0;
      font-size: 0.85rem;
      color: #991b1b;
    }

    .invoice-dialog__actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      margin-top: 1.25rem;
    }

    .invoice-dialog__actions ::ng-deep .db-button {
      white-space: nowrap;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvoiceMarkDialogComponent {
  readonly data = inject<InvoiceMarkDialogData>(DIALOG_DATA);
  private readonly dialogRef =
    inject<DialogRef<InvoiceMarkDialogResult | undefined>>(DialogRef);

  pointOfSale =
    this.data.pointOfSale != null
      ? String(this.data.pointOfSale).padStart(4, '0')
      : '';
  number = '';
  issuedAt = todayYmd();
  error = '';

  private get posDigits(): string {
    return String(this.pointOfSale ?? '').trim();
  }

  private get numberDigits(): string {
    return String(this.number ?? '').trim();
  }

  get canConfirm(): boolean {
    return (
      /^\d{1,5}$/.test(this.posDigits) &&
      /^\d{1,8}$/.test(this.numberDigits) &&
      !!this.issuedAt
    );
  }

  confirm(): void {
    if (!this.canConfirm) return;
    const date = new Date(`${this.issuedAt}T12:00:00`);
    if (Number.isNaN(date.getTime())) {
      this.error = 'La fecha no es válida.';
      return;
    }
    this.dialogRef.close({
      number: `${this.posDigits.padStart(4, '0')}-${this.numberDigits.padStart(8, '0')}`,
      issuedAt: date.toISOString(),
    });
  }

  cancel(): void {
    this.dialogRef.close(undefined);
  }
}
