import { findColorById } from '../common/color.util';
import { ColorConfig, Spool, Supply } from '../common/interfaces';

export interface PrinterSlotView {
  slot: number;
  spool?: Spool;
  color?: ColorConfig | null;
}

export interface PrinterSlotApiRow {
  slot: number;
  spoolId: string | null;
  code: string | null;
  color: { id: string; name: string; hex: string } | null;
  remainingGrams: number | null;
}

/**
 * Fuente única del AMS: color de cada ranura = bobina abierta ubicada ahí
 * (supply.colorId). Sin bobina → ranura vacía.
 */
export function printerSlots(
  printerId: string,
  spools: Spool[],
  supplies: Supply[],
  colors: ColorConfig[],
): PrinterSlotView[] {
  const openOnPrinter = spools.filter(
    (s) =>
      !s.finishedAt &&
      s.location.kind === 'printer' &&
      s.location.printerId === printerId,
  );

  const bySlot = new Map<number, Spool>();
  for (const spool of openOnPrinter) {
    if (spool.location.kind !== 'printer') continue;
    const slot = Number(spool.location.slot);
    if (slot < 1 || slot > 4) continue;
    // Si hay más de una (dato inconsistente), gana la de menor remanente.
    const prev = bySlot.get(slot);
    if (!prev || Number(spool.remainingGrams) < Number(prev.remainingGrams)) {
      bySlot.set(slot, spool);
    }
  }

  const supplyById = new Map(supplies.map((s) => [s.id, s]));
  const rows: PrinterSlotView[] = [];
  for (let slot = 1; slot <= 4; slot++) {
    const spool = bySlot.get(slot);
    if (!spool) {
      rows.push({ slot });
      continue;
    }
    const supply = supplyById.get(spool.supplyId);
    const color = supply?.colorId
      ? (findColorById(colors, supply.colorId) ?? null)
      : null;
    rows.push({ slot, spool, color });
  }
  return rows;
}

export function printerSlotsApi(
  printerId: string,
  spools: Spool[],
  supplies: Supply[],
  colors: ColorConfig[],
): PrinterSlotApiRow[] {
  return printerSlots(printerId, spools, supplies, colors).map((row) => ({
    slot: row.slot,
    spoolId: row.spool?.id ?? null,
    code: row.spool?.code ?? null,
    color: row.color
      ? { id: row.color.id, name: row.color.name, hex: row.color.hex }
      : null,
    remainingGrams: row.spool ? Number(row.spool.remainingGrams) : null,
  }));
}
