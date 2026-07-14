import { RetailSale, RetailSaleItem } from '../../common/interfaces';

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
  notes: string | null;
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
  return {
    id: row.id,
    total: row.total,
    notes: row.notes ?? undefined,
    soldAt: row.soldAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    items: row.items.map((item) => mapRetailSaleItemFromDb(item)),
  };
}

export function mapRetailSaleToDb(sale: RetailSale) {
  return {
    id: sale.id,
    total: sale.total,
    notes: sale.notes ?? null,
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
