import { Supply } from '../../common/interfaces';

export function mapSupplyFromDb(row: {
  id: string;
  name: string;
  type: string;
  filamentType: string | null;
  resinType: string | null;
  brand: string | null;
  unit: string;
  quantity: number;
  minStock: number;
  unitPrice: number;
  priceFromSettings: boolean;
  supplier: string | null;
  updatedAt: Date;
}): Supply {
  return {
    id: row.id,
    name: row.name,
    type: row.type as Supply['type'],
    filamentType: row.filamentType as Supply['filamentType'],
    resinType: row.resinType as Supply['resinType'],
    brand: row.brand ?? undefined,
    unit: row.unit,
    quantity: row.quantity,
    minStock: row.minStock,
    unitPrice: row.unitPrice,
    priceFromSettings: row.priceFromSettings,
    supplier: row.supplier ?? undefined,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function mapSupplyToDb(supply: Supply) {
  return {
    id: supply.id,
    name: supply.name,
    type: supply.type,
    filamentType: supply.filamentType ?? null,
    resinType: supply.resinType ?? null,
    brand: supply.brand ?? null,
    unit: supply.unit,
    quantity: supply.quantity,
    minStock: supply.minStock,
    unitPrice: supply.unitPrice,
    priceFromSettings: supply.priceFromSettings,
    supplier: supply.supplier ?? null,
    updatedAt: new Date(supply.updatedAt),
  };
}
