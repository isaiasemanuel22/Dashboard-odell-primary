import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import {
  DbButtonComponent,
  DbFormComponent,
  DbSelectComponent,
} from '@general-components';
import type { DbSelectOption } from '@dashboard-form/db-select/db-select.types';
import { TreasuryAccount } from '../core/models';
import { labelsToSelectOptions } from '../shared/utils/select-options';
import { TREASURY_ACCOUNT_LABELS } from '../shared/utils/v1-labels.util';
import { DbInputComponent } from '@dashboard-form';
import { FormDialogShellComponent } from './form-dialog-shell/form-dialog-shell.component';

export interface FairAmountDialogData {
  title: string;
  confirmLabel: string;
  amountLabel: string;
  /** Si está, pide también un nombre (gasto). */
  nameLabel?: string;
  namePlaceholder?: string;
  hint?: string;
  /** Si es true, el monto debe ser mayor a cero. */
  amountRequired?: boolean;
  /** Si es true, muestra el selector de cuenta (Caja efectivo por defecto). */
  showAccount?: boolean;
}

export interface FairAmountDialogResult {
  name: string;
  amount: number;
  account: TreasuryAccount;
}

/** Diálogo corto de la feria: fondo inicial (solo monto) o gasto (nombre + monto). */
@Component({
  standalone: true,
  imports: [
    FormsModule,
    FormDialogShellComponent,
    DbButtonComponent,
    DbFormComponent,
    DbInputComponent,
    DbSelectComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    db-form {
      display: flex;
      flex-direction: column;
      gap: 18px;
      padding-bottom: 24px;
      box-sizing: border-box;
    }
  `,
  template: `
    <app-form-dialog-shell
      [title]="data.title"
      size="sm"
      [footerBar]="true"
      (close)="cancel()"
    >
      <db-form>
        @if (data.nameLabel) {
          <db-input
            [label]="data.nameLabel"
            name="fairAmountName"
            [(ngModel)]="name"
            [placeholder]="data.namePlaceholder ?? ''"
            [required]="true"
          />
        }
        <db-input
          [label]="data.amountLabel"
          type="number"
          name="fairAmount"
          [(ngModel)]="amount"
          [min]="0"
          [hint]="data.hint ?? ''"
        />
        @if (data.showAccount) {
          <db-select
            label="Cuenta"
            name="fairAmountAccount"
            [(ngModel)]="account"
            [options]="accountOptions"
          />
        }
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
        [label]="data.confirmLabel"
        variant="primary"
        format="solid"
        [disabled]="!canSave()"
        (clicked)="confirm()"
      />
    </app-form-dialog-shell>
  `,
})
export class FairAmountDialogComponent {
  private readonly dialogRef = inject(
    DialogRef<FairAmountDialogResult | undefined>,
  );
  readonly data = inject<FairAmountDialogData>(DIALOG_DATA);

  name = '';
  amount: number | null = null;
  account: TreasuryAccount = TreasuryAccount.CAJA;
  readonly accountOptions: DbSelectOption[] = labelsToSelectOptions(
    TREASURY_ACCOUNT_LABELS,
  );

  canSave(): boolean {
    const value = Number(this.amount);
    if (this.data.nameLabel && !this.name.trim()) return false;
    if (this.data.amountRequired) return Number.isFinite(value) && value > 0;
    return this.amount === null || (Number.isFinite(value) && value >= 0);
  }

  cancel(): void {
    this.dialogRef.close(undefined);
  }

  confirm(): void {
    if (!this.canSave()) return;
    this.dialogRef.close({
      name: this.name.trim(),
      amount: Math.max(0, Number(this.amount) || 0),
      account: this.account,
    });
  }
}
