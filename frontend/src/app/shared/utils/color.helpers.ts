import {
  ColorConfig,
  FilamentType,
  INDISTINTO_COLOR_ID,
  isProduct3D,
  Product,
  ProductType,
  ResinType,
  Supply,
  SupplyCategory,
} from '../../core/models';
import type { DbColorSelectOption } from '@dashboard-form/db-color-select/db-color-select.types';

/** Vacío / null / blank → Indistinto (presupuesto, pedido y producto). */
export function normalizeColorId(value: unknown): string {
  if (typeof value !== 'string') return INDISTINTO_COLOR_ID;
  const trimmed = value.trim();
  return trimmed ? trimmed : INDISTINTO_COLOR_ID;
}

export function resolveColorLabel(
  colorId: string | undefined,
  catalog: ColorConfig[],
): string {
  if (!colorId || colorId === INDISTINTO_COLOR_ID) {
    return 'Indistinto';
  }
  return catalog.find((color) => color.id === colorId)?.name ?? colorId;
}

export function resolveColorHex(
  colorId: string | undefined,
  catalog: ColorConfig[],
): string | undefined {
  if (!colorId || colorId === INDISTINTO_COLOR_ID) {
    return undefined;
  }
  return catalog.find((color) => color.id === colorId)?.hex;
}

/** Distancia euclídea RGB entre dos hex (#RRGGBB). */
export function hexColorDistance(a: string, b: string): number {
  const ra = parseHexRgb(a);
  const rb = parseHexRgb(b);
  if (!ra || !rb) return Number.POSITIVE_INFINITY;
  const dr = ra.r - rb.r;
  const dg = ra.g - rb.g;
  const db = ra.b - rb.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/**
 * Color del catálogo más cercano al hex. Si la distancia supera el umbral,
 * devuelve Indistinto para que el usuario elija.
 */
export function nearestCatalogColorId(
  hex: string | undefined,
  catalog: ColorConfig[],
  maxDistance = 48,
): string {
  if (!hex || !catalog.length) return INDISTINTO_COLOR_ID;
  let bestId = INDISTINTO_COLOR_ID;
  let best = Number.POSITIVE_INFINITY;
  for (const color of catalog) {
    const d = hexColorDistance(hex, color.hex);
    if (d < best) {
      best = d;
      bestId = color.id;
    }
  }
  return best <= maxDistance ? bestId : INDISTINTO_COLOR_ID;
}

function parseHexRgb(
  hex: string,
): { r: number; g: number; b: number } | null {
  const cleaned = hex.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) return null;
  return {
    r: Number.parseInt(cleaned.slice(0, 2), 16),
    g: Number.parseInt(cleaned.slice(2, 4), 16),
    b: Number.parseInt(cleaned.slice(4, 6), 16),
  };
}

export function supplyRequiresColor(category: SupplyCategory): boolean {
  return (
    category === SupplyCategory.FDM ||
    category === SupplyCategory.RESINA ||
    category === SupplyCategory.ESTAMPADO
  );
}

function suppliesCompatibleWith(
  supply: Supply,
  selected: Supply,
): boolean {
  if (supply.category !== selected.category) {
    return false;
  }
  if (selected.filamentType && supply.filamentType !== selected.filamentType) {
    return false;
  }
  if (selected.resinType && supply.resinType !== selected.resinType) {
    return false;
  }
  return true;
}

export function buildColorOptions(
  supplies: Supply[],
  catalog: ColorConfig[],
  filter: {
    filamentType?: FilamentType;
    resinType?: ResinType | string;
    supplyId?: string;
    category?: SupplyCategory;
  },
): DbColorSelectOption[] {
  let compatible = supplies;

  if (filter.filamentType) {
    compatible = compatible.filter(
      (supply) =>
        supply.category === SupplyCategory.FDM &&
        supply.filamentType === filter.filamentType,
    );
  } else if (filter.resinType) {
    compatible = compatible.filter(
      (supply) =>
        supply.category === SupplyCategory.RESINA &&
        supply.resinType === filter.resinType,
    );
  } else if (filter.supplyId) {
    const selected = supplies.find((supply) => supply.id === filter.supplyId);
    compatible = selected
      ? supplies.filter((supply) => suppliesCompatibleWith(supply, selected))
      : [];
  } else if (filter.category) {
    compatible = compatible.filter(
      (supply) => supply.category === filter.category,
    );
  }

  const stockIds = new Set<string>();
  for (const supply of compatible) {
    if (supply.colorId) {
      stockIds.add(supply.colorId);
    }
  }

  const options: DbColorSelectOption[] = [
    {
      value: INDISTINTO_COLOR_ID,
      label: 'Indistinto',
      hint: 'el que haya en stock',
    },
  ];

  // Catálogo completo: el popover marca «Con stock» con inStock.
  for (const color of catalog) {
    options.push({
      value: color.id,
      label: color.name,
      hex: color.hex,
      inStock: stockIds.has(color.id),
    });
  }

  return options;
}

export function productRequiresColor(product: Product): boolean {
  if (!isProduct3D(product)) {
    return product.type === ProductType.ESTAMPADO;
  }
  return true;
}

export function resolveProductColorOptions(
  supplies: Supply[],
  catalog: ColorConfig[],
  product: Product,
): DbColorSelectOption[] {
  if (product.type === ProductType.FDM) {
    return buildColorOptions(supplies, catalog, {
      filamentType: product.filamentType,
    });
  }
  if (product.type === ProductType.RESINA) {
    return buildColorOptions(supplies, catalog, {
      resinType: product.resinType,
    });
  }
  if (product.type === ProductType.ESTAMPADO) {
    return buildColorOptions(supplies, catalog, {
      category: SupplyCategory.ESTAMPADO,
    });
  }
  return [{ value: INDISTINTO_COLOR_ID, label: 'Indistinto' }];
}

export function buildColorOptionsForProduct(
  product: Product | undefined,
  supplies: Supply[],
  catalog: ColorConfig[],
): DbColorSelectOption[] {
  if (!product) {
    return [{ value: INDISTINTO_COLOR_ID, label: 'Indistinto' }];
  }
  return resolveProductColorOptions(supplies, catalog, product);
}
