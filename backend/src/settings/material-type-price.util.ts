import { FilamentType, ResinType } from '../common/enums';
import { SupplyCategory } from '../common/enums';
import { GeneralSettings, Supply } from '../common/interfaces';
import { normalizeSupplyUnit } from '../supplies/supply-units.util';

export type MaterialPriceSource = 'supplies' | 'settings';

export interface ResolvedMaterialPrice {
  price: number;
  /** `supplies`: promedio de Insumos. `settings`: respaldo de Ajustes. */
  source: MaterialPriceSource;
}

/**
 * Convierte el unitPrice de un insumo a $/kg (filamento) o $/L (resina).
 * Unidades g/ml: el precio es por gramo/ml, se multiplica por 1000.
 * Sin unidad reconocida se asume kg/L (default de la categoría).
 */
export function supplyUnitPriceToBase(
  supply: Pick<Supply, 'unitPrice' | 'unit'>,
): number {
  const price = Number(supply.unitPrice) || 0;
  const unit = normalizeSupplyUnit(supply.unit);
  if (unit === 'g' || unit === 'ml') return price * 1000;
  return price;
}

function averageSupplyPrice(
  supplies: Supply[],
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
  supplies: Supply[],
  materialType: FilamentType | undefined,
): number | null {
  if (!materialType) return null;
  return averageSupplyPrice(
    supplies,
    (supply) =>
      supply.category === SupplyCategory.FDM &&
      supply.filamentType === materialType,
  );
}

/** Promedio $/L de los insumos de resina del tipo (y marca si se pide). */
export function averageResinSupplyPricePerLiter(
  supplies: Supply[],
  resinType: ResinType | string | undefined,
  brand?: string,
): number | null {
  if (!resinType) return null;
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

/** Precio $/kg del tipo: Insumos primero, Ajustes como respaldo. */
export function resolveFilamentMaterialPrice(
  settings: GeneralSettings,
  supplies: Supply[],
  materialType: FilamentType | undefined,
): ResolvedMaterialPrice | null {
  const fromSupplies = averageFilamentSupplyPricePerKg(supplies, materialType);
  if (fromSupplies !== null) return { price: fromSupplies, source: 'supplies' };
  const fallback = resolveFilamentPricePerKg(settings, materialType);
  return fallback === null ? null : { price: fallback, source: 'settings' };
}

/** Precio $/L del tipo: Insumos primero, Ajustes como respaldo. */
export function resolveResinMaterialPrice(
  settings: GeneralSettings,
  supplies: Supply[],
  resinType: ResinType | string | undefined,
  brand?: string,
): ResolvedMaterialPrice | null {
  const fromSupplies = averageResinSupplyPricePerLiter(
    supplies,
    resinType,
    brand,
  );
  if (fromSupplies !== null) return { price: fromSupplies, source: 'supplies' };
  const fallback = resolveResinPricePerLiter(settings, resinType);
  return fallback === null ? null : { price: fallback, source: 'settings' };
}

export function averageFilamentPriceByType(
  settings: GeneralSettings,
  materialType: FilamentType,
): number | null {
  const matches = settings.filamentPrices.filter(
    (entry) => entry.materialType === (materialType as string),
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
