import { Supplier, Supply } from '../common/interfaces';
import { StoreState } from '../store/store.state';

function nextSupplierId(suppliers: Supplier[]): string {
  const numbers = suppliers
    .map((item) => parseInt(item.id.split('-')[1] ?? '0', 10))
    .filter((n) => !Number.isNaN(n));
  const next = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
  return `suplr-${next}`;
}

function findByNameCI(
  suppliers: Supplier[],
  name: string,
): Supplier | undefined {
  const key = name.trim().toLowerCase();
  return suppliers.find((s) => s.name.trim().toLowerCase() === key);
}

/**
 * Migración idempotente al cargar el store:
 * por cada texto distinto de Supply.supplier sin supplierId, crea proveedor
 * (demora 3) y vincula; mantiene `supplier` sincronizado con el nombre.
 */
export function adoptLegacySuppliers(state: StoreState): void {
  if (!state.suppliers) state.suppliers = [];
  const now = new Date().toISOString();

  for (const supply of state.supplies ?? []) {
    if (supply.supplierId) {
      const linked = state.suppliers.find((s) => s.id === supply.supplierId);
      if (linked) {
        supply.supplier = linked.name;
      }
      continue;
    }

    const text = supply.supplier?.trim();
    if (!text) continue;

    let supplier = findByNameCI(state.suppliers, text);
    if (!supplier) {
      supplier = {
        id: nextSupplierId(state.suppliers),
        name: text,
        leadTimeBusinessDays: 3,
        createdAt: now,
        updatedAt: now,
      };
      state.suppliers.push(supplier);
    }
    supply.supplierId = supplier.id;
    supply.supplier = supplier.name;
  }
}

/** Sincroniza el texto `supplier` de un supply con el nombre del proveedor. */
export function syncSupplySupplierText(
  supply: Supply,
  suppliers: Supplier[],
): void {
  if (!supply.supplierId) {
    return;
  }
  const linked = suppliers.find((s) => s.id === supply.supplierId);
  if (linked) {
    supply.supplier = linked.name;
  }
}
