import { FilamentType, GeneralSettings, ResinType } from '../../core/models';

/**
 * @deprecated La resina se carga en ml; el costo usa ml/1000 × $/L.
 * Se mantiene por compatibilidad de imports.
 */
export const RESIN_DENSITY_G_PER_ML = 1.1;

export function averageFilamentPriceByType(
  settings: GeneralSettings,
  materialType: FilamentType,
): number | null {
  const matches = settings.filamentPrices.filter(
    (entry) => entry.materialType === materialType,
  );
  if (!matches.length) {
    return null;
  }
  const total = matches.reduce((sum, entry) => sum + entry.pricePerKg, 0);
  return total / matches.length;
}

export function averageResinPriceByType(
  settings: GeneralSettings,
  resinType: ResinType | string,
): number | null {
  const matches = settings.resinPrices.filter(
    (entry) => entry.resinType === resinType,
  );
  if (!matches.length) {
    return null;
  }
  const total = matches.reduce((sum, entry) => sum + entry.pricePerLiter, 0);
  return total / matches.length;
}

export function resolveFilamentPricePerKg(
  settings: GeneralSettings,
  materialType: FilamentType | undefined,
): number | null {
  if (!materialType) {
    return null;
  }
  const configured = settings.filamentTypeAverages?.[materialType];
  if (configured != null && configured > 0) {
    return configured;
  }
  return averageFilamentPriceByType(settings, materialType);
}

export function resolveResinPricePerLiter(
  settings: GeneralSettings,
  resinType: ResinType | string | undefined,
): number | null {
  if (!resinType) {
    return null;
  }
  const configured = settings.resinTypeAverages?.[resinType];
  if (configured != null && configured > 0) {
    return configured;
  }
  return averageResinPriceByType(settings, resinType);
}

/**
 * Costo de material de resina sin marca.
 * `ml` es el volumen cargado (campo `grams` del modelo para líneas/productos resina).
 * litros = ml / 1000; costo = litros × $/L del tipo.
 */
export function resinMaterialCost(
  settings: GeneralSettings,
  resinType: ResinType | string | undefined,
  ml: number,
): number {
  const pricePerLiter = resolveResinPricePerLiter(settings, resinType);
  if (pricePerLiter == null) return 0;
  return ((Number(ml) || 0) / 1000) * pricePerLiter;
}
