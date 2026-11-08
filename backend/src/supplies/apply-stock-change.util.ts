import {
  Supply,
  SupplyMovement,
  SupplyMovementReason,
} from '../common/interfaces';
import { StoreService } from '../store/store.service';
import {
  gramsToSupplyQuantity,
  supplyQuantityToGrams,
} from './supply-units.util';

export interface ApplyStockChangeMeta {
  jobId?: string;
  spoolId?: string;
  userId?: string;
  /** Si se pasa, se guarda en el movimiento; si no, se deriva del delta. */
  grams?: number;
  at?: string;
}

/**
 * Cambia `supply.quantity` y registra un movimiento en el store.
 * `delta` está en la unidad del supply (puede ser negativo).
 */
export function applyStockChange(
  store: StoreService,
  supply: Supply,
  delta: number,
  reason: SupplyMovementReason,
  meta: ApplyStockChangeMeta = {},
): SupplyMovement {
  const amount = Number(delta) || 0;
  const next = Number(supply.quantity) + amount;
  supply.quantity = next < 1e-9 && next > -1e-9 ? 0 : Math.max(0, next);
  supply.updatedAt = meta.at ?? new Date().toISOString();

  const grams =
    meta.grams !== undefined
      ? Number(meta.grams)
      : supplyQuantityToGrams({ ...supply, quantity: amount });

  const movement: SupplyMovement = {
    id: store.nextSupplyMovementId(),
    supplyId: supply.id,
    delta: amount,
    grams: Number.isFinite(grams) ? grams : undefined,
    reason,
    jobId: meta.jobId,
    spoolId: meta.spoolId,
    at: supply.updatedAt,
    userId: meta.userId,
  };
  store.supplyMovements.push(movement);
  return movement;
}

/** Aplica un delta expresado en gramos (convierte a la unidad del supply). */
export function applyStockChangeGrams(
  store: StoreService,
  supply: Supply,
  gramsDelta: number,
  reason: SupplyMovementReason,
  meta: ApplyStockChangeMeta = {},
): SupplyMovement {
  const delta = gramsToSupplyQuantity(supply, gramsDelta);
  return applyStockChange(store, supply, delta, reason, {
    ...meta,
    grams: gramsDelta,
  });
}
