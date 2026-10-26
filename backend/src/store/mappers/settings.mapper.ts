import { Prisma } from '@prisma/client';
import { GeneralSettings } from '../../common/interfaces';
import { fromJson, toInputJson } from '../../prisma/json.util';
import {
  ensureMachineProfiles,
  parseMachineProfilesFromDb,
} from '../../settings/machine-profile.util';
import {
  normalizePaperReferenceSheets,
  referenceSheetFromPricePerSqm,
  syncPaperPricesFromReferenceSheets,
} from '../../common/paper-cost.util';
import { normalizeProfitMargins } from '../../settings/profit-margins.util';
import {
  persistedFilamentPrice,
  persistedResinPrice,
} from '../brand-link.util';

export function mapSettingsFromDb(row: {
  electricityCostPerKwh: number;
  laborCostPerHour: number;
  modelingRatePerHour: number;
  graphicDesignRatePerHour: number;
  errorMarginPercent?: number;
  profitMargins: Prisma.JsonValue;
  paperPricesPerSqm: Prisma.JsonValue;
  paperReferenceSheets?: Prisma.JsonValue;
  powerConsumptions: Prisma.JsonValue;
  machineCosts: Prisma.JsonValue;
  processProfiles?: Prisma.JsonValue;
  filamentPrices: Prisma.JsonValue;
  resinPrices: Prisma.JsonValue;
  filamentTypeAverages?: Prisma.JsonValue;
  resinTypeAverages?: Prisma.JsonValue;
  colors?: Prisma.JsonValue;
}): GeneralSettings {
  const rawProfiles = fromJson<unknown[]>(row.processProfiles ?? []);
  const paperPricesPerSqm = fromJson<GeneralSettings['paperPricesPerSqm']>(
      row.paperPricesPerSqm,
    );
  const rawSheets = fromJson<Partial<GeneralSettings['paperReferenceSheets']>>(
    row.paperReferenceSheets ?? {},
  );
  const hasSavedSheets = Object.keys(rawSheets).length > 0;
  const base: GeneralSettings = {
    electricityCostPerKwh: row.electricityCostPerKwh,
    errorMarginPercent: row.errorMarginPercent ?? 0,
    laborCostPerHour: row.laborCostPerHour,
    modelingRatePerHour: row.modelingRatePerHour ?? 0,
    graphicDesignRatePerHour: row.graphicDesignRatePerHour ?? 0,
    profitMargins: fromJson<GeneralSettings['profitMargins']>(
      row.profitMargins,
    ),
    paperPricesPerSqm,
    paperReferenceSheets: normalizePaperReferenceSheets(
      rawSheets,
      paperPricesPerSqm,
    ),
    powerConsumptions: fromJson<GeneralSettings['powerConsumptions']>(
      row.powerConsumptions,
    ),
    machineCosts: fromJson<GeneralSettings['machineCosts']>(row.machineCosts),
    machineProfiles: [],
    filamentPrices: fromJson<GeneralSettings['filamentPrices']>(
      row.filamentPrices,
    ),
    resinPrices: fromJson<GeneralSettings['resinPrices']>(row.resinPrices),
    filamentTypeAverages: fromJson<GeneralSettings['filamentTypeAverages']>(
      row.filamentTypeAverages ?? {},
    ),
    resinTypeAverages: fromJson<GeneralSettings['resinTypeAverages']>(
      row.resinTypeAverages ?? {},
    ),
    colors: fromJson<GeneralSettings['colors']>(row.colors ?? []),
  };

  base.profitMargins = normalizeProfitMargins(base.profitMargins);
  if (hasSavedSheets) {
    base.paperPricesPerSqm = syncPaperPricesFromReferenceSheets(
      base.paperReferenceSheets,
    );
  }
  base.machineProfiles = parseMachineProfilesFromDb(rawProfiles, base);
  return base;
}

export function mapSettingsToDb(settings: GeneralSettings) {
  const normalized = {
    ...settings,
    profitMargins: normalizeProfitMargins(settings.profitMargins),
    machineProfiles: ensureMachineProfiles(settings),
  };

  return {
    electricityCostPerKwh: normalized.electricityCostPerKwh,
    errorMarginPercent: normalized.errorMarginPercent,
    laborCostPerHour: normalized.laborCostPerHour,
    modelingRatePerHour: normalized.modelingRatePerHour ?? 0,
    graphicDesignRatePerHour: normalized.graphicDesignRatePerHour ?? 0,
    profitMargins: toInputJson(normalized.profitMargins),
    paperPricesPerSqm: toInputJson(
      syncPaperPricesFromReferenceSheets(normalized.paperReferenceSheets),
    ),
    paperReferenceSheets: toInputJson(normalized.paperReferenceSheets),
    powerConsumptions: toInputJson(normalized.powerConsumptions),
    machineCosts: toInputJson(normalized.machineCosts),
    processProfiles: toInputJson(normalized.machineProfiles),
    filamentPrices: toInputJson(
      normalized.filamentPrices.map(persistedFilamentPrice),
    ),
    resinPrices: toInputJson(normalized.resinPrices.map(persistedResinPrice)),
    filamentTypeAverages: toInputJson(normalized.filamentTypeAverages),
    resinTypeAverages: toInputJson(normalized.resinTypeAverages),
    colors: toInputJson(normalized.colors ?? []),
  };
}
