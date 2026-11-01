import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Output,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { TreasuryAccount } from '../../../../core/models';
import { TreasuryService } from '../../../../core/services/treasury.service';
import {
  DbButtonComponent,
  DbFormGridComponent,
  DbInputComponent,
  DbSelectComponent,
  FormModalComponent,
} from '@general-components';
import type { DbSelectOption } from '@dashboard-form/db-select/db-select.types';
import { CurrencyArsPipe } from '../../../../shared/pipes/labels.pipe';
import { extractApiErrorMessage } from '../../../../shared/utils/api-error';
import { labelsToSelectOptions } from '../../../../shared/utils/select-options';
import { TREASURY_ACCOUNT_LABELS } from '../../../../shared/utils/v1-labels.util';

@Component({
  selector: 'app-wallet-transfer-form',
  standalone: true,
  imports: [
    FormsModule,
    CurrencyArsPipe,
    DbButtonComponent,
    DbInputComponent,
    DbSelectComponent,
    DbFormGridComponent,
    FormModalComponent,
  ],
  templateUrl: './wallet-transfer-form.component.html',
  styleUrl: '../wallet-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WalletTransferFormComponent {
  private readonly treasuryService = inject(TreasuryService);
  private readonly cdr = inject(ChangeDetectorRef);

  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  readonly maxTransferDate = WalletTransferFormComponent.todayInputValue();
  readonly accountOptions: DbSelectOption[] =
    labelsToSelectOptions(TREASURY_ACCOUNT_LABELS);

  fromAccount: TreasuryAccount = TreasuryAccount.CAJA;
  toAccount: TreasuryAccount = TreasuryAccount.BANCO;
  amount = 0;
  transferDate = WalletTransferFormComponent.todayInputValue();
  saving = false;
  formError = '';

  onAmountChange(): void {
    this.amount = Math.max(0, Math.round(Number(this.amount) || 0));
    this.cdr.markForCheck();
  }

  submitTransfer(): void {
    const occurredAt = this.transferDate;
    const amount = Math.round(Number(this.amount) || 0);

    if (!occurredAt) {
      this.formError = 'Seleccioná una fecha.';
      this.cdr.markForCheck();
      return;
    }

    if (this.fromAccount === this.toAccount) {
      this.formError = 'La cuenta de origen y destino tienen que ser distintas.';
      this.cdr.markForCheck();
      return;
    }

    if (amount <= 0) {
      this.formError = 'El monto debe ser mayor a cero.';
      this.cdr.markForCheck();
      return;
    }

    this.saving = true;
    this.formError = '';
    this.cdr.markForCheck();

    this.treasuryService
      .createTransfer({
        from: this.fromAccount,
        to: this.toAccount,
        amount,
        occurredAt,
      })
      .pipe(
        finalize(() => {
          this.saving = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: () => this.saved.emit(),
        error: (err) => {
          this.formError = extractApiErrorMessage(
            err,
            'No se pudo registrar la transferencia',
          );
          this.cdr.markForCheck();
        },
      });
  }

  private static todayInputValue(): string {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${now.getFullYear()}-${month}-${day}`;
  }
}
