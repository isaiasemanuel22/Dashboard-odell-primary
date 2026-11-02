import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  TreasuryAccount,
  TreasuryAccountBalance,
  TreasuryOverview,
} from '../../../../core/models';
import { CurrencyArsPipe } from '../../../../shared/pipes/labels.pipe';
import { TREASURY_ACCOUNTS_ORDER } from '../../../../shared/utils/treasury-account.util';
import { treasuryAccountLabel } from '../../../../shared/utils/v1-labels.util';

/** Textos de apoyo del artboard (no vienen de la API). */
const ACCOUNT_HELP: Partial<Record<TreasuryAccount, string>> = {
  [TreasuryAccount.CAJA]: 'Ferias y mostrador',
  [TreasuryAccount.BANCO]: 'Transferencias',
};

export type WalletAccountFilter = 'all' | TreasuryAccount;

@Component({
  selector: 'app-wallet-metrics',
  standalone: true,
  imports: [CurrencyArsPipe, RouterLink],
  templateUrl: './wallet-metrics.component.html',
  styleUrl: './wallet-metrics.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WalletMetricsComponent {
  @Input({ required: true }) overview!: TreasuryOverview;
  @Input() clientDebt = 0;
  /** Período mostrado en la tarjeta mobile (ej. «noviembre 2026»). */
  @Input() periodLabel = '';
  /** Cuenta elegida en el scroll mobile; no afecta el layout desktop. */
  @Input() selectedAccount: WalletAccountFilter = 'all';
  @Output() accountSelect = new EventEmitter<WalletAccountFilter>();

  readonly accountOrder = TREASURY_ACCOUNTS_ORDER;

  accountBalance(account: TreasuryAccount): TreasuryAccountBalance | undefined {
    return this.overview.accounts.find((entry) => entry.account === account);
  }

  accountLabel(account: TreasuryAccount): string {
    return treasuryAccountLabel(account);
  }

  accountHelp(account: TreasuryAccount): string | null {
    return ACCOUNT_HELP[account] ?? null;
  }

  isMercadoPago(account: TreasuryAccount): boolean {
    return account === TreasuryAccount.MERCADO_PAGO;
  }

  onSelectAccount(account: WalletAccountFilter): void {
    this.accountSelect.emit(account);
  }
}
