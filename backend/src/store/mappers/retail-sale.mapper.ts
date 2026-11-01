import { PaymentMethod, TreasuryAccount } from '../../common/enums';
import { RetailSale, RetailSaleItem } from '../../common/interfaces';
import { defaultAccountForMethod } from '../../treasury/treasury-account.util';

function normalizeMethod(value?: string | null): PaymentMethod | undefined {
  if (!value) return undefined;
  return Object.values(PaymentMethod).includes(value as PaymentMethod)
    ? (value as PaymentMethod)
    : undefined;
}

function normalizeAccount(value?: string | null): TreasuryAccount | undefined {
  if (!value) return undefined;
  return Object.values(TreasuryAccount).includes(value as TreasuryAccount)
    ? (value as TreasuryAccount)
    : undefined;
}

export function mapRetailSaleItemFromDb(item: {
  productId: string | null;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}): RetailSaleItem {
  return {
    productId: item.productId ?? undefined,
    productName: item.productName,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    lineTotal: item.lineTotal,
  };
}

export function mapRetailSaleFromDb(row: {
  id: string;
  total: number;
  discountPercent?: number;
  discountAmount?: number;
  notes: string | null;
  method?: string | null;
  account?: string | null;
  soldAt: Date;
  createdAt: Date;
  items: Array<{
    productId: string | null;
    productName: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
}): RetailSale {
  const method = normalizeMethod(row.method) ?? PaymentMethod.EFECTIVO;
  const account =
    normalizeAccount(row.account) ?? defaultAccountForMethod(method);

  return {
    id: row.id,
    total: row.total,
    discountPercent: row.discountPercent ?? 0,
    discountAmount: row.discountAmount ?? 0,
    notes: row.notes ?? undefined,
    method,
    account,
    soldAt: row.soldAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    items: row.items.map((item) => mapRetailSaleItemFromDb(item)),
  };
}

export function mapRetailSaleToDb(sale: RetailSale) {
  const method = sale.method ?? PaymentMethod.EFECTIVO;
  return {
    id: sale.id,
    total: sale.total,
    discountPercent: sale.discountPercent ?? 0,
    discountAmount: sale.discountAmount ?? 0,
    notes: sale.notes ?? null,
    method,
    account: sale.account ?? defaultAccountForMethod(method),
    soldAt: new Date(sale.soldAt),
    createdAt: new Date(sale.createdAt),
  };
}

export function mapRetailSaleItemToDb(
  saleId: string,
  index: number,
  item: RetailSaleItem,
) {
  return {
    id: `${saleId}-item-${index}`,
    retailSaleId: saleId,
    sortIndex: index,
    productId: item.productId ?? null,
    productName: item.productName,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    lineTotal: item.lineTotal,
  };
}
