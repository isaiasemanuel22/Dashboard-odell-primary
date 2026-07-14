import { Prisma } from '@prisma/client';
import { GeneralSettings } from '../../common/interfaces';
import { fromJson, toInputJson } from '../../prisma/json.util';
import {
  ensureMachineProfiles,
  parseMachineProfilesFromDb,
} from '../../settings/machine-profile.util';

export function mapSettingsFromDb(row: {
  electricityCostPerKwh: number;
  laborCostPerHour: number;
  profitMargins: Prisma.JsonValue;
  paperPricesPerSqm: Prisma.JsonValue;
  powerConsumptions: Prisma.JsonValue;
  machineCosts: Prisma.JsonValue;
  processProfiles?: Prisma.JsonValue;
  filamentPrices: Prisma.JsonValue;
  resinPrices: Prisma.JsonValue;
}): GeneralSettings {
  const rawProfiles = fromJson<unknown[]>(row.processProfiles ?? []);
  const base: GeneralSettings = {
    electricityCostPerKwh: row.electricityCostPerKwh,
    laborCostPerHour: row.laborCostPerHour,
    profitMargins: fromJson<GeneralSettings['profitMargins']>(
      row.profitMargins,
    ),
    paperPricesPerSqm: fromJson<GeneralSettings['paperPricesPerSqm']>(
      row.paperPricesPerSqm,
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
  };

  base.machineProfiles = parseMachineProfilesFromDb(rawProfiles, base);
  return base;
}

export function mapSettingsToDb(settings: GeneralSettings) {
  const normalized = {
    ...settings,
    machineProfiles: ensureMachineProfiles(settings),
  };

  return {
    electricityCostPerKwh: normalized.electricityCostPerKwh,
    laborCostPerHour: normalized.laborCostPerHour,
    profitMargins: toInputJson(normalized.profitMargins),
    paperPricesPerSqm: toInputJson(normalized.paperPricesPerSqm),
    powerConsumptions: toInputJson(normalized.powerConsumptions),
    machineCosts: toInputJson(normalized.machineCosts),
    processProfiles: toInputJson(normalized.machineProfiles),
    filamentPrices: toInputJson(normalized.filamentPrices),
    resinPrices: toInputJson(normalized.resinPrices),
  };
}
