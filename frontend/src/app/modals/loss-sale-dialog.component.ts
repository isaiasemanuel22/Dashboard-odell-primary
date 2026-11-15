import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { DbButtonComponent } from '@general-components';
import { DbTextareaComponent } from '@dashboard-form';
import { formatCurrencyArs } from '../shared/utils/currency-ars.util';
import {
  LOSS_REASONS,
  LOSS_REASON_NOTE_MAX,
  LossReasonCode,
} from '../shared/utils/loss-reason';
import type { LossSaleLine } from '../shared/utils/loss-sale.util';
import { ConfirmLeadComponent } from './confirm-lead/confirm-lead.component';
import { FormDialogShellComponent } from './form-dialog-shell/form-dialog-shell.component';

export interface LossSaleDialogData {
  /** Líneas con precio por debajo del costo. */
  lines: LossSaleLine[];
  /** Ganancia total del documento (negativa si pierde en el total). */
  profit: number;
  profitNegative: boolean;
  /** Motivo ya cargado (se precarga al reabrir). */
  lossReason?: string;
  lossReasonNote?: string;
  /** Texto del botón de confirmar (por defecto «Vender igual»). */
  confirmLabel?: string;
}

export interface LossSaleDialogResult {
  lossReason: string;
  lossReasonNote?: string;
}

@Component({
  standalone: true,
  imports: [
    FormsModule,
    FormDialogShellComponent,
    ConfirmLeadComponent,
    DbButtonComponent,
    DbTextareaComponent,
  ],
  templateUrl: './loss-sale-dialog.component.html',
  styleUrl: './loss-sale-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LossSaleDialogComponent {
  readonly data = inject<LossSaleDialogData>(DIALOG_DATA);
  private readonly dialogRef = inject(DialogRef<LossSaleDialogResult | undefined>);

  readonly reasons = LOSS_REASONS;
  readonly noteMax = LOSS_REASON_NOTE_MAX;
  readonly reason = signal<string>(this.initialReason());
  readonly note = signal(this.data.lossReasonNote ?? '');

  readonly noteRequired = computed(() => this.reason() === 'otro');
  readonly canConfirm = computed(() => {
    if (!this.reason()) return false;
    const note = this.note().trim();
    if (this.noteRequired() && !note) return false;
    return note.length <= LOSS_REASON_NOTE_MAX;
  });

  money(value: number): string {
    return formatCurrencyArs(value);
  }

  select(code: LossReasonCode): void {
    this.reason.set(code);
  }

  confirm(): void {
    if (!this.canConfirm()) return;
    const note = this.note().trim().slice(0, LOSS_REASON_NOTE_MAX);
    this.dialogRef.close({
      lossReason: this.reason(),
      ...(note ? { lossReasonNote: note } : {}),
    });
  }

  cancel(): void {
    this.dialogRef.close(undefined);
  }

  private initialReason(): string {
    const code = this.data.lossReason;
    return LOSS_REASONS.some((r) => r.code === code) ? (code as string) : '';
  }
}
