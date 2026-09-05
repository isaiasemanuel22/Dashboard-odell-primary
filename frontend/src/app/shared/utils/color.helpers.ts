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
    resinType?: ResinType;
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

  const colorIds = new Set<string>();
  for (const supply of compatible) {
    if (supply.colorId) {
      colorIds.add(supply.colorId);
    }
  }

  const options: DbColorSelectOption[] = [
    { value: INDISTINTO_COLOR_ID, label: 'Indistinto' },
  ];

  for (const color of catalog) {
    if (colorIds.has(color.id)) {
      options.push({
        value: color.id,
        label: color.name,
        hex: color.hex,
      });
    }
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
