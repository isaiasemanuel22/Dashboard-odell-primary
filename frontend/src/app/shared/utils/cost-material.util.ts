import {
  CalculateCostPayload,
  FdmFilamentLine,
  FilamentType,
  GeneralSettings,
  Supply,
} from '../../core/models';
import { resolveFdmFilaments } from './fdm.helpers';
import { resolveFilamentPricePerKg } from './material-type-price.util';

/**
 * Precio por kg promedio simple de las filas FDM (no ponderado por gramos).
 * Sin filas: precio del filamentType del producto.
 * Paridad con `backend/src/settings/cost-material.calc.ts`.
 */
export function averageFdmFilamentPricePerKg(
  dto: Pick<CalculateCostPayload, 'filaments' | 'filamentType' | 'grams' | 'brand'>,
  settings: GeneralSettings,
  supplies?: readonly Supply[],
): number | null {
  const filaments = resolveFdmFilaments(dto);
  if (filaments.length) {
    const prices = filaments
      .map((line) => resolveFilamentPricePerKg(settings, line.filamentType, supplies))
      .filter((price): price is number => price !== null);
    if (!prices.length) return null;
    return prices.reduce((sum, price) => sum + price, 0) / prices.length;
  }
  return resolveFilamentPricePerKg(settings, dto.filamentType, supplies);
}

/**
 * Costo de purga AMS: purgeGrams/1000 × precio/kg promedio simple de filas.
 * purgeGrams null/0 → 0.
 */
export function calcPurgeCost(
  purgeGrams: number | null | undefined,
  dto: Pick<CalculateCostPayload, 'filaments' | 'filamentType' | 'grams' | 'brand'>,
  settings: GeneralSettings,
  supplies?: readonly Supply[],
): number {
  const grams = Math.max(0, Number(purgeGrams) || 0);
  if (grams <= 0) return 0;
  const pricePerKg = averageFdmFilamentPricePerKg(dto, settings, supplies);
  if (pricePerKg === null) return 0;
  return (grams / 1000) * pricePerKg;
}

/** Precio/kg promedio simple de filas ya resueltas (UI de purga). */
export function averageFilamentLinesPricePerKg(
  lines: FdmFilamentLine[],
  settings: GeneralSettings,
  fallbackType?: FilamentType,
  supplies?: readonly Supply[],
): number | null {
  return averageFdmFilamentPricePerKg(
    { filaments: lines, filamentType: fallbackType },
    settings,
    supplies,
  );
}
