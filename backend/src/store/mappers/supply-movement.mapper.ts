import { SupplyMovement, SupplyMovementReason } from '../../common/interfaces';

export function mapSupplyMovementFromDb(row: {
  id: string;
  supplyId: string;
  delta: number;
  grams: number | null;
  reason: string;
  jobId: string | null;
  spoolId: string | null;
  at: Date;
  userId: string | null;
}): SupplyMovement {
  return {
    id: row.id,
    supplyId: row.supplyId,
    delta: row.delta,
    grams: row.grams ?? undefined,
    reason: row.reason as SupplyMovementReason,
    jobId: row.jobId ?? undefined,
    spoolId: row.spoolId ?? undefined,
    at: row.at.toISOString(),
    userId: row.userId ?? undefined,
  };
}

export function mapSupplyMovementToDb(movement: SupplyMovement) {
  return {
    id: movement.id,
    supplyId: movement.supplyId,
    delta: movement.delta,
    grams: movement.grams ?? null,
    reason: movement.reason,
    jobId: movement.jobId ?? null,
    spoolId: movement.spoolId ?? null,
    at: new Date(movement.at),
    userId: movement.userId ?? null,
  };
}
