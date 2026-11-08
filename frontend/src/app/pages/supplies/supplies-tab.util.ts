export type SuppliesPageTab = 'insumos' | 'bobinas' | 'reposicion';

export const SUPPLIES_TAB_STORAGE_KEY = 'odell.supplies.activeTab';

export function parseSuppliesTab(
  raw: string | null | undefined,
): SuppliesPageTab | null {
  if (raw === 'bobinas' || raw === 'reposicion' || raw === 'insumos') {
    return raw;
  }
  return null;
}

export function readStoredSuppliesTab(): SuppliesPageTab | null {
  try {
    return parseSuppliesTab(localStorage.getItem(SUPPLIES_TAB_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function storeSuppliesTab(tab: SuppliesPageTab): void {
  try {
    localStorage.setItem(SUPPLIES_TAB_STORAGE_KEY, tab);
  } catch {
    /* ignore quota / private mode */
  }
}

export function supplyQuantityToGrams(supply: {
  quantity: number;
  unit: string;
}): number {
  const q = Number(supply.quantity) || 0;
  const unit = (supply.unit || '').trim();
  if (unit === 'kg') return q * 1000;
  if (unit === 'g') return q;
  return q;
}

export function formatCoversDays(days: number | null): string {
  if (days == null || !Number.isFinite(days)) return '—';
  if (days < 7) {
    const n = Math.max(0, Math.round(days));
    return n === 1 ? '1 día' : `${n} días`;
  }
  if (days < 60) {
    const n = Math.round(days);
    return n === 1 ? '1 día' : `${n} días`;
  }
  const weeks = Math.round(days / 7);
  return weeks === 1 ? '1 semana' : `${weeks} semanas`;
}
