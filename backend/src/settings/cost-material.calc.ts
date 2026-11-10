import {
  FilamentType,
  PaperType,
  ProductType,
  ResinType,
} from '../common/enums';
import {
  CalculateCostDto,
  GeneralSettings,
  Supply,
} from '../common/interfaces';
import { calcWashSupplyCost } from './machine-profile.util';
import {
  resolveFilamentPricePerKg,
  resolveResinPricePerLiter,
} from './material-type-price.util';
import { resolveFdmFilaments } from '../products/fdm-product.util';

export function calculateMaterialCost(
  dto: CalculateCostDto,
  settings: GeneralSettings,
  supplies: Supply[],
  calcEstampadoMaterialCost: (dto: CalculateCostDto) => number,
  brandedResinPricePerLiter: (
    brand: string,
    resinType: ResinType | string | undefined,
  ) => number | null,
): number {
  const grams = Number(dto.grams) || 0;

  if (dto.type === ProductType.FDM) {
    const filaments = resolveFdmFilaments(dto);
    if (filaments.length) {
      return filaments.reduce(
        (sum, line) =>
          sum + calcFilamentCost(line.filamentType, line.grams, settings),
        0,
      );
    }
    return calcFilamentCost(dto.filamentType, grams, settings);
  }
  if (dto.type === ProductType.RESINA) {
    return (
      calcResinCost(
        dto.brand,
        dto.resinType,
        grams,
        settings,
        brandedResinPricePerLiter,
      ) + calcWashSupplyCost(settings, supplies, dto.type)
    );
  }
  if (dto.type === ProductType.ESTAMPADO) {
    return calcEstampadoMaterialCost(dto);
  }
  return 0;
}

export function calcFilamentCost(
  materialType: FilamentType | undefined,
  grams: number,
  settings: GeneralSettings,
): number {
  const pricePerKg = resolveFilamentPricePerKg(settings, materialType);
  if (pricePerKg === null) return 0;
  return (grams / 1000) * pricePerKg;
}

/**
 * Precio por kg promedio simple de las filas FDM (no ponderado por gramos).
 * Sin filas: precio del filamentType del producto.
 */
export function averageFdmFilamentPricePerKg(
  dto: Pick<CalculateCostDto, 'filaments' | 'filamentType' | 'grams' | 'brand'>,
  settings: GeneralSettings,
): number | null {
  const filaments = resolveFdmFilaments(dto);
  if (filaments.length) {
    const prices = filaments
      .map((line) => resolveFilamentPricePerKg(settings, line.filamentType))
      .filter((price): price is number => price !== null);
    if (!prices.length) return null;
    return prices.reduce((sum, price) => sum + price, 0) / prices.length;
  }
  return resolveFilamentPricePerKg(settings, dto.filamentType);
}

/**
 * Costo de purga AMS: purgeGrams/1000 × precio/kg promedio simple de filas.
 * purgeGrams null/0 → 0.
 */
export function calcPurgeCost(
  purgeGrams: number | null | undefined,
  dto: Pick<CalculateCostDto, 'filaments' | 'filamentType' | 'grams' | 'brand'>,
  settings: GeneralSettings,
): number {
  const grams = Math.max(0, Number(purgeGrams) || 0);
  if (grams <= 0) return 0;
  const pricePerKg = averageFdmFilamentPricePerKg(dto, settings);
  if (pricePerKg === null) return 0;
  return (grams / 1000) * pricePerKg;
}

export function calcResinCost(
  brand: string | undefined,
  resinType: ResinType | string | undefined,
  grams: number,
  settings: GeneralSettings,
  brandedPricePerLiter: (
    brand: string,
    resinType: ResinType | string | undefined,
  ) => number | null,
): number {
  const pricePerLiter = brand
    ? brandedPricePerLiter(brand, resinType)
    : resolveResinPricePerLiter(settings, resinType);
  if (pricePerLiter === null) return 0;
  // Campo grams del DTO = ml de resina.
  const liters = grams / 1000;
  return liters * pricePerLiter;
}

export function paperPricePerSqm(
  paperType: PaperType,
  paperPricesPerSqm: GeneralSettings['paperPricesPerSqm'],
): number {
  const prices = paperPricesPerSqm;
  switch (paperType) {
    case PaperType.SUBLIMACION:
      return prices.sublimacion;
    case PaperType.DTF:
      return prices.dtf;
    case PaperType.DTF_UV:
      return prices.dtfUv;
    default:
      return 0;
  }
}

export function calculateErrorMarginCost(
  materialCost: number,
  energyCost: number,
  machineCost: number,
  settings: GeneralSettings,
  purgeCost = 0,
): number {
  const percent = Math.min(
    Math.max(Number(settings.errorMarginPercent) || 0, 0),
    100,
  );
  if (percent === 0) {
    return 0;
  }
  const base =
    materialCost + Math.max(0, Number(purgeCost) || 0) + energyCost + machineCost;
  return Math.round(base * (percent / 100));
}
