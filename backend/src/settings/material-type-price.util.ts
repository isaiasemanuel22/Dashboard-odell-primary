import { FilamentType, ResinType } from '../common/enums';
import { GeneralSettings } from '../common/interfaces';

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
  resinType: ResinType,
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
  resinType: ResinType | undefined,
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
