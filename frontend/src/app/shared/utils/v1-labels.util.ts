import {
  CustomerSource,
  CustomerType,
  PaymentMethod,
  PriceType,
  SalesChannel,
  TreasuryAccount,
} from '../../core/models';

export const CUSTOMER_TYPE_LABELS: Record<CustomerType, string> = {
  [CustomerType.PARTICULAR]: 'Particular',
  [CustomerType.EMPRESA]: 'Empresa',
  [CustomerType.REVENDEDOR]: 'Revendedor',
};

export const CUSTOMER_SOURCE_LABELS: Record<CustomerSource, string> = {
  [CustomerSource.INSTAGRAM]: 'Instagram',
  [CustomerSource.WHATSAPP]: 'WhatsApp',
  [CustomerSource.TIENDANUBE]: 'Tienda Nube',
  [CustomerSource.FERIA]: 'Feria',
  [CustomerSource.RECOMENDACION]: 'Recomendación',
  [CustomerSource.OTRO]: 'Otro',
};

export const SALES_CHANNEL_LABELS: Record<SalesChannel, string> = {
  [SalesChannel.MAYORISTA]: 'Mayorista',
  [SalesChannel.INSTAGRAM]: 'Instagram',
  [SalesChannel.WHATSAPP]: 'WhatsApp',
  [SalesChannel.TIENDANUBE]: 'Tienda Nube',
  [SalesChannel.FERIA]: 'Feria',
  [SalesChannel.MOSTRADOR]: 'Mostrador',
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  [PaymentMethod.EFECTIVO]: 'Efectivo',
  [PaymentMethod.TRANSFERENCIA]: 'Transferencia',
  [PaymentMethod.MERCADO_PAGO]: 'Mercado Pago',
};

export const TREASURY_ACCOUNT_LABELS: Record<TreasuryAccount, string> = {
  [TreasuryAccount.CAJA]: 'Caja efectivo',
  [TreasuryAccount.MERCADO_PAGO]: 'Mercado Pago',
  [TreasuryAccount.BANCO]: 'Banco',
};

export const PRICE_TYPE_LABELS: Record<PriceType, string> = {
  [PriceType.LISTA]: 'Lista',
  [PriceType.MAYORISTA]: 'Mayorista',
};

export function customerTypeLabel(value: CustomerType | string | null | undefined): string {
  if (value && value in CUSTOMER_TYPE_LABELS) {
    return CUSTOMER_TYPE_LABELS[value as CustomerType];
  }
  return value ? String(value) : '';
}

export function customerSourceLabel(
  value: CustomerSource | string | null | undefined,
): string {
  if (value && value in CUSTOMER_SOURCE_LABELS) {
    return CUSTOMER_SOURCE_LABELS[value as CustomerSource];
  }
  return value ? String(value) : '';
}

export function salesChannelLabel(
  value: SalesChannel | string | null | undefined,
): string {
  if (!value) return '';
  if (value === 'sin_canal') return 'Sin canal';
  if (value in SALES_CHANNEL_LABELS) {
    return SALES_CHANNEL_LABELS[value as SalesChannel];
  }
  return String(value);
}

export function paymentMethodLabel(
  value: PaymentMethod | string | null | undefined,
): string {
  if (value && value in PAYMENT_METHOD_LABELS) {
    return PAYMENT_METHOD_LABELS[value as PaymentMethod];
  }
  return value ? String(value) : '';
}

export function treasuryAccountLabel(
  value: TreasuryAccount | string | null | undefined,
): string {
  if (value && value in TREASURY_ACCOUNT_LABELS) {
    return TREASURY_ACCOUNT_LABELS[value as TreasuryAccount];
  }
  return value ? String(value) : '';
}

export function priceTypeLabel(value: PriceType | string | null | undefined): string {
  if (value && value in PRICE_TYPE_LABELS) {
    return PRICE_TYPE_LABELS[value as PriceType];
  }
  return value ? String(value) : '';
}
