import { Spool } from '../common/interfaces';

export interface AllocateSpoolPortion {
  spoolId: string;
  code: string;
  grams: number;
  remainingAfter: number;
}

export interface AllocateResult {
  /** Porciones tomadas de bobinas abiertas. */
  spools: AllocateSpoolPortion[];
  /** Gramos que no cubrieron bobinas (salen del stock cerrado). */
  closedGrams: number;
  /** Total solicitado. */
  requestedGrams: number;
}

function isOpen(spool: Spool): boolean {
  return !spool.finishedAt && Number(spool.remainingGrams) > 1e-9;
}

/**
 * Reparte `grams` entre bobinas abiertas del supply:
 * 1) ubicadas en la impresora del job (si hay printerId);
 * 2) resto de abiertas del supply, menor remanente primero.
 * Lo que no cubran queda en closedGrams.
 */
export function allocateSpools(
  openSpools: Spool[],
  grams: number,
  printerId?: string | null,
): AllocateResult {
  const requested = Math.max(0, Number(grams) || 0);
  if (requested <= 1e-9) {
    return { spools: [], closedGrams: 0, requestedGrams: 0 };
  }

  const candidates = openSpools.filter(isOpen);
  const onPrinter = printerId
    ? candidates.filter(
        (s) =>
          s.location.kind === 'printer' && s.location.printerId === printerId,
      )
    : [];
  const others = candidates
    .filter((s) => !onPrinter.some((p) => p.id === s.id))
    .sort(
      (a, b) =>
        Number(a.remainingGrams) - Number(b.remainingGrams) ||
        a.code.localeCompare(b.code, 'es'),
    );

  const ordered = [...onPrinter, ...others];
  const portions: AllocateSpoolPortion[] = [];
  let remaining = requested;

  for (const spool of ordered) {
    if (remaining <= 1e-9) break;
    const available = Number(spool.remainingGrams);
    if (available <= 1e-9) continue;
    const take = Math.min(available, remaining);
    portions.push({
      spoolId: spool.id,
      code: spool.code,
      grams: take,
      remainingAfter: Math.max(0, available - take),
    });
    remaining -= take;
  }

  return {
    spools: portions,
    closedGrams: Math.max(0, remaining),
    requestedGrams: requested,
  };
}
