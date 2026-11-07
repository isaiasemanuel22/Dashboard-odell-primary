import type { MobileChipOption } from '@general-components';

/** Pestañas del registro unificado de billetera (mobile). */
export type WalletMovementKind =
  | 'income'
  | 'expense'
  | 'purchase'
  | 'transfer';

export const WALLET_MOVEMENT_KIND_OPTIONS: MobileChipOption<WalletMovementKind>[] =
  [
    { value: 'income', label: 'Ingreso' },
    { value: 'expense', label: 'Egreso' },
    { value: 'purchase', label: 'Compra' },
    { value: 'transfer', label: 'Transferir' },
  ];
