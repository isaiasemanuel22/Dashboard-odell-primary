import { Spool, SpoolLocation } from '../../common/interfaces';

function mapLocationFromDb(row: {
  locationKind: string;
  printerId: string | null;
  slot: number | null;
  shelfText: string | null;
}): SpoolLocation {
  if (row.locationKind === 'printer' && row.printerId && row.slot != null) {
    return {
      kind: 'printer',
      printerId: row.printerId,
      slot: Number(row.slot),
    };
  }
  return {
    kind: 'shelf',
    text: row.shelfText?.trim() || 'Sin ubicar',
  };
}

export function mapSpoolFromDb(row: {
  id: string;
  code: string;
  supplyId: string;
  initialGrams: number;
  remainingGrams: number;
  locationKind: string;
  printerId: string | null;
  slot: number | null;
  shelfText: string | null;
  openedAt: Date;
  finishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): Spool {
  return {
    id: row.id,
    code: row.code,
    supplyId: row.supplyId,
    initialGrams: row.initialGrams,
    remainingGrams: row.remainingGrams,
    location: mapLocationFromDb(row),
    openedAt: row.openedAt.toISOString(),
    finishedAt: row.finishedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function mapSpoolToDb(spool: Spool) {
  const location = spool.location;
  return {
    id: spool.id,
    code: spool.code,
    supplyId: spool.supplyId,
    initialGrams: spool.initialGrams,
    remainingGrams: spool.remainingGrams,
    locationKind: location.kind,
    printerId: location.kind === 'printer' ? location.printerId : null,
    slot: location.kind === 'printer' ? location.slot : null,
    shelfText: location.kind === 'shelf' ? location.text : null,
    openedAt: new Date(spool.openedAt),
    finishedAt: spool.finishedAt ? new Date(spool.finishedAt) : null,
    createdAt: new Date(spool.createdAt),
    updatedAt: new Date(spool.updatedAt),
  };
}
