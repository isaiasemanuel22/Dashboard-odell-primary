import {
  FilamentType,
  GeneralSettings,
  ResinType,
  Supply,
  SupplyCategory,
} from '../../core/models';

export type MaterialPriceSource = 'supplies' | 'settings';

export interface ResolvedMaterialPrice {
  price: number;
  /** `supplies`: promedio de Insumos. `settings`: respaldo de Ajustes. */
  source: MaterialPriceSource;
}

/** unitPrice del insumo a $/kg o $/L (g/ml: el precio es por gramo/ml). */
export function supplyUnitPriceToBase(
  supply: Pick<Supply, 'unitPrice' | 'unit'>,
): number {
  const price = Number(supply.unitPrice) || 0;
  const unit = (supply.unit ?? '').trim().toLowerCase();
  if (unit === 'g' || unit === 'ml') return price * 1000;
  return price;
}

function averageSupplyPrice(
  supplies: readonly Supply[],
  matches: (supply: Supply) => boolean,
): number | null {
  const prices = supplies
    .filter(matches)
    .map((supply) => supplyUnitPriceToBase(supply))
    .filter((price) => price > 0);
  if (!prices.length) return null;
  return prices.reduce((sum, price) => sum + price, 0) / prices.length;
}

/** Promedio $/kg de los insumos de filamento del tipo (precio > 0). */
export function averageFilamentSupplyPricePerKg(
  supplies: readonly Supply[] | undefined,
  materialType: FilamentType | undefined,
): number | null {
  if (!materialType || !supplies?.length) return null;
  return averageSupplyPrice(
    supplies,
    (supply) =>
      supply.category === SupplyCategory.FDM &&
      supply.filamentType === materialType,
  );
}

/** Promedio $/L de los insumos de resina del tipo (y marca si se pide). */
export function averageResinSupplyPricePerLiter(
  supplies: readonly Supply[] | undefined,
  resinType: ResinType | string | undefined,
  brand?: string,
): number | null {
  if (!resinType || !supplies?.length) return null;
  const ofType = (supply: Supply) =>
    supply.category === SupplyCategory.RESINA && supply.resinType === resinType;
  if (brand) {
    const wanted = brand.trim().toLowerCase();
    const branded = averageSupplyPrice(
      supplies,
      (supply) =>
        ofType(supply) && (supply.brand ?? '').trim().toLowerCase() === wanted,
    );
    if (branded !== null) return branded;
  }
  return averageSupplyPrice(supplies, ofType);
}

/** Texto para la UI: "$X/kg · promedio de Insumos" o respaldo de Ajustes. */
export function materialPriceSourceLabel(source: MaterialPriceSource): string {
  return source === 'supplies'
    ? 'promedio de Insumos'
    : 'de Ajustes (no hay precio en Insumos)';
}

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

function settingsFilamentPricePerKg(
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

function settingsResinPricePerLiter(
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

/** $/kg del tipo: promedio de Insumos; respaldo: Ajustes. */
export function resolveFilamentMaterialPrice(
  settings: GeneralSettings,
  materialType: FilamentType | undefined,
  supplies?: readonly Supply[],
): ResolvedMaterialPrice | null {
  const fromSupplies = averageFilamentSupplyPricePerKg(supplies, materialType);
  if (fromSupplies !== null) return { price: fromSupplies, source: 'supplies' };
  const fallback = settingsFilamentPricePerKg(settings, materialType);
  return fallback === null ? null : { price: fallback, source: 'settings' };
}

/** $/L del tipo: promedio de Insumos; respaldo: Ajustes. */
export function resolveResinMaterialPrice(
  settings: GeneralSettings,
  resinType: ResinType | string | undefined,
  supplies?: readonly Supply[],
  brand?: string,
): ResolvedMaterialPrice | null {
  const fromSupplies = averageResinSupplyPricePerLiter(
    supplies,
    resinType,
    brand,
  );
  if (fromSupplies !== null) return { price: fromSupplies, source: 'supplies' };
  const fallback = settingsResinPricePerLiter(settings, resinType);
  return fallback === null ? null : { price: fallback, source: 'settings' };
}

export function resolveFilamentPricePerKg(
  settings: GeneralSettings,
  materialType: FilamentType | undefined,
  supplies?: readonly Supply[],
): number | null {
  return resolveFilamentMaterialPrice(settings, materialType, supplies)?.price ?? null;
}

export function resolveResinPricePerLiter(
  settings: GeneralSettings,
  resinType: ResinType | string | undefined,
  supplies?: readonly Supply[],
  brand?: string,
): number | null {
  return resolveResinMaterialPrice(settings, resinType, supplies, brand)?.price ?? null;
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
  supplies?: readonly Supply[],
): number {
  const pricePerLiter = resolveResinPricePerLiter(settings, resinType, supplies);
  if (pricePerLiter == null) return 0;
  return ((Number(ml) || 0) / 1000) * pricePerLiter;
}
