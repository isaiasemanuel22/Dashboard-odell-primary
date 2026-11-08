import { Supplier } from '../../common/interfaces';

export function mapSupplierFromDb(row: {
  id: string;
  name: string;
  leadTimeBusinessDays: number;
  contact: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}): Supplier {
  return {
    id: row.id,
    name: row.name,
    leadTimeBusinessDays: row.leadTimeBusinessDays ?? 3,
    contact: row.contact ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function mapSupplierToDb(supplier: Supplier) {
  return {
    id: supplier.id,
    name: supplier.name,
    leadTimeBusinessDays: supplier.leadTimeBusinessDays,
    contact: supplier.contact ?? null,
    notes: supplier.notes ?? null,
    createdAt: new Date(supplier.createdAt),
    updatedAt: new Date(supplier.updatedAt),
  };
}
