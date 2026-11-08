import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  Output,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { TreasuryExpense } from '../../../../core/models';
import { TreasuryService } from '../../../../core/services/treasury.service';
import {
  DbButtonComponent,
  DbInputComponent,
  FormModalComponent,
} from '@general-components';
import { ConfirmLeadComponent } from '../../../../modals/confirm-lead/confirm-lead.component';
import { CurrencyArsPipe } from '../../../../shared/pipes/labels.pipe';
import { extractApiErrorMessage } from '../../../../shared/utils/api-error';

@Component({
  selector: 'app-wallet-void-form',
  standalone: true,
  imports: [
    FormsModule,
    CurrencyArsPipe,
    DbButtonComponent,
    DbInputComponent,
    ConfirmLeadComponent,
    FormModalComponent,
  ],
  templateUrl: './wallet-void-form.component.html',
  styleUrl: '../wallet-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WalletVoidFormComponent {
  private readonly treasuryService = inject(TreasuryService);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input({ required: true }) expense!: TreasuryExpense;
  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  reason = '';
  saving = false;
  formError = '';

  submitVoid(): void {
    const reason = this.reason.trim();
    if (!reason) {
      this.formError = 'Ingresá el motivo de la anulación.';
      this.cdr.markForCheck();
      return;
    }

    if (reason.length > 255) {
      this.formError = 'El motivo no puede superar 255 caracteres.';
      this.cdr.markForCheck();
      return;
    }

    this.saving = true;
    this.formError = '';
    this.cdr.markForCheck();

    this.treasuryService
      .voidExpense(this.expense.id, { reason })
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
            'No se pudo anular el registro',
          );
          this.cdr.markForCheck();
        },
      });
  }
}
