import {
  ColorConfig,
  FilamentType,
  INDISTINTO_COLOR_ID,
  ResinType,
  Supply,
  SupplyCategory,
  SupplyType,
} from '../../core/models';
import { DbSelectOption } from '@general-components';

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

export function supplyRequiresColor(type: SupplyType): boolean {
  return (
    type === SupplyType.FILAMENTO ||
    type === SupplyType.RESINA ||
    [
      SupplyType.TINTA,
      SupplyType.REMERA,
      SupplyType.TAZA,
      SupplyType.BUZO,
      SupplyType.GORRA,
      SupplyType.FILM,
      SupplyType.VINILO,
    ].includes(type)
  );
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
): DbSelectOption[] {
  let compatible = supplies;

  if (filter.filamentType) {
    compatible = compatible.filter(
      (supply) =>
        supply.category === SupplyCategory.FDM &&
        supply.type === SupplyType.FILAMENTO &&
        supply.filamentType === filter.filamentType,
    );
  } else if (filter.resinType) {
    compatible = compatible.filter(
      (supply) =>
        supply.category === SupplyCategory.RESINA &&
        supply.type === SupplyType.RESINA &&
        supply.resinType === filter.resinType,
    );
  } else if (filter.supplyId) {
    const selected = supplies.find((supply) => supply.id === filter.supplyId);
    compatible = selected
      ? supplies.filter(
          (supply) =>
            supply.category === selected.category &&
            supply.type === selected.type,
        )
      : [];
  } else if (filter.category) {
    compatible = compatible.filter(
      (supply) => supply.category === filter.category,
    );
  }

  const colorIds = new Set(
    compatible
      .map((supply) => supply.colorId)
      .filter((colorId): colorId is string => Boolean(colorId)),
  );

  const options: DbSelectOption[] = [
    { value: INDISTINTO_COLOR_ID, label: 'Indistinto' },
  ];

  for (const color of catalog) {
    if (colorIds.has(color.id)) {
      options.push({ value: color.id, label: color.name });
    }
  }

  return options;
}
