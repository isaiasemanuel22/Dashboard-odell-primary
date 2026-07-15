import { MachineProfileRole, ProductType } from '../common/enums';
import {
  GeneralSettings,
  MachineProfile,
  Supply,
} from '../common/interfaces';

export interface MachineTimeContext {
  printTimeHours: number;
  washMinutes?: number;
  cureMinutes?: number;
  pressMinutes?: number;
}

type StoredMachineProfile = MachineProfile & {
  productType?: ProductType;
  productTypes?: ProductType[];
};

/** Perfil de proceso anidado (legacy). */
interface LegacyProcessProfile {
  productType: ProductType;
  equipment: Array<{
    id: string;
    name: string;
    role: MachineProfileRole;
    watts: number;
    costPerHour: number;
    consumptionMl?: number;
    washSupplyId?: string;
  }>;
}

export function parseMachineProfilesFromDb(
  raw: unknown,
  settings: GeneralSettings,
): MachineProfile[] {
  if (Array.isArray(raw) && raw.length) {
    if (
      typeof raw[0] === 'object' &&
      raw[0] !== null &&
      'equipment' in raw[0]
    ) {
      return ensureMachineProfiles({
        ...settings,
        machineProfiles: [],
        processProfiles: raw as LegacyProcessProfile[],
      } as GeneralSettings & { processProfiles: LegacyProcessProfile[] });
    }
    return ensureMachineProfiles({
      ...settings,
      machineProfiles: raw as MachineProfile[],
    });
  }
  return ensureMachineProfiles({ ...settings, machineProfiles: [] });
}

export function createDefaultMachineProfiles(): MachineProfile[] {
  return [
    {
      id: 'mp-fdm-print',
      name: 'Impresora FDM',
      role: MachineProfileRole.PRINT,
      watts: 120,
      costPerHour: 150,
      productType: ProductType.FDM,
    },
    {
      id: 'mp-res-print',
      name: 'Impresora resina',
      role: MachineProfileRole.PRINT,
      watts: 60,
      costPerHour: 200,
      productType: ProductType.RESINA,
    },
    {
      id: 'mp-res-wash',
      name: 'Lavadora',
      role: MachineProfileRole.WASH,
      watts: 80,
      costPerHour: 80,
      productType: ProductType.RESINA,
      consumptionMl: 80,
      washBathUses: 10,
    },
    {
      id: 'mp-res-cure',
      name: 'Curadora',
      role: MachineProfileRole.CURE,
      watts: 40,
      costPerHour: 60,
      productType: ProductType.RESINA,
    },
    {
      id: 'mp-press',
      name: 'Plancha',
      role: MachineProfileRole.PRESS,
      watts: 350,
      costPerHour: 100,
      productType: ProductType.ESTAMPADO,
    },
  ];
}

export function ensureMachineProfiles(
  settings: GeneralSettings,
): MachineProfile[] {
  const raw = settings.machineProfiles ?? [];
  if (raw.length) {
    return normalizeMachineProfiles(raw);
  }

  const legacy = (settings as GeneralSettings & {
    processProfiles?: LegacyProcessProfile[];
  }).processProfiles;
  if (legacy?.length) {
    return normalizeMachineProfiles(migrateFromLegacyProfiles(legacy));
  }

  const migrated = migrateLegacyPowerAndMachineCosts(
    settings.powerConsumptions ?? [],
    settings.machineCosts ?? [],
  );
  return migrated.length
    ? normalizeMachineProfiles(migrated)
    : createDefaultMachineProfiles();
}

function migrateFromLegacyProfiles(
  legacy: LegacyProcessProfile[],
): MachineProfile[] {
  return legacy.flatMap((profile) =>
    profile.equipment.map((equipment) => ({
      id: equipment.id,
      name: equipment.name,
      role: equipment.role,
      watts: equipment.watts,
      costPerHour: equipment.costPerHour,
      productType: profile.productType,
      washSupplyId: equipment.washSupplyId,
      consumptionMl: equipment.consumptionMl,
    })),
  );
}

function migrateLegacyPowerAndMachineCosts(
  powerConsumptions: GeneralSettings['powerConsumptions'],
  machineCosts: GeneralSettings['machineCosts'],
): MachineProfile[] {
  return createDefaultMachineProfiles().map((profile) => {
    const productType = profile.productType ?? ProductType.FDM;
    const power = findLegacyMatch(powerConsumptions, productType);
    const machine = findLegacyMatch(machineCosts, productType);
    return {
      ...profile,
      name: power?.name ?? machine?.name ?? profile.name,
      watts: power?.watts ?? profile.watts,
      costPerHour:
        ('costPerHour' in (machine ?? {})
          ? machine?.costPerHour
          : undefined) ?? profile.costPerHour,
    };
  });
}

function findLegacyMatch<
  T extends { name: string; watts?: number; costPerHour?: number },
>(items: T[], productType: ProductType): T | undefined {
  const keywords: Record<ProductType, string[]> = {
    [ProductType.FDM]: ['fdm'],
    [ProductType.RESINA]: ['resina'],
    [ProductType.ESTAMPADO]: ['estampado', 'prensa', 'plancha', 'estamp'],
    [ProductType.COMBO]: [],
  };

  return items.find((item) =>
    keywords[productType].some((keyword) =>
      item.name.toLowerCase().includes(keyword),
    ),
  );
}

export function resolveProfileProductType(
  profile: StoredMachineProfile,
): ProductType | undefined {
  if (profile.productType) {
    return profile.productType;
  }
  if (profile.productTypes?.length) {
    return profile.productTypes[0];
  }
  return undefined;
}

export function profileMatchesProductType(
  profile: StoredMachineProfile,
  productType: ProductType,
): boolean {
  const type = resolveProfileProductType(profile);
  return type === undefined || type === productType;
}

export function resolveWashBathUses(value?: number | null): number {
  const uses = Number(value);
  if (!Number.isFinite(uses) || uses <= 0) {
    return 10;
  }
  return uses;
}

export function normalizeMachineProfiles(
  profiles: StoredMachineProfile[],
): MachineProfile[] {
  return profiles
    .filter((profile) => profile.name?.trim())
    .map((profile) => {
      const productType = resolveProfileProductType(profile);
      return {
        id: profile.id,
        name: profile.name.trim(),
        role: profile.role,
        watts: Math.max(Number(profile.watts) || 0, 0),
        costPerHour: Math.max(Number(profile.costPerHour) || 0, 0),
        productType,
        washSupplyId: profile.washSupplyId,
        consumptionMl:
          profile.consumptionMl !== undefined
            ? Math.max(Number(profile.consumptionMl) || 0, 0)
            : undefined,
        washBathUses:
          profile.role === MachineProfileRole.WASH &&
          profile.washBathUses !== undefined &&
          profile.washBathUses !== null
            ? Number(profile.washBathUses)
            : undefined,
      };
    });
}

export function getMachineProfilesForProductType(
  settings: GeneralSettings,
  productType: ProductType,
): MachineProfile[] {
  return ensureMachineProfiles(settings).filter((profile) =>
    profileMatchesProductType(profile, productType),
  );
}

export function resolveMachineHours(
  profile: MachineProfile,
  context: MachineTimeContext,
): number {
  switch (profile.role) {
    case MachineProfileRole.PRINT:
      return Math.max(Number(context.printTimeHours) || 0, 0);
    case MachineProfileRole.WASH:
      return Math.max(Number(context.washMinutes) || 0, 0) / 60;
    case MachineProfileRole.CURE:
      return Math.max(Number(context.cureMinutes) || 0, 0) / 60;
    case MachineProfileRole.PRESS:
      return Math.max(Number(context.pressMinutes) || 0, 0) / 60;
    default:
      return 0;
  }
}

export function calculateMachineOverhead(
  settings: GeneralSettings,
  productType: ProductType,
  context: MachineTimeContext,
): { energyCost: number; machineCost: number } {
  const profiles = getMachineProfilesForProductType(settings, productType);
  const costPerKwh = settings.electricityCostPerKwh;

  let energyCost = 0;
  let machineCost = 0;

  for (const profile of profiles) {
    const hours = resolveMachineHours(profile, context);
    energyCost += (profile.watts / 1000) * hours * costPerKwh;
    machineCost += profile.costPerHour * hours;
  }

  return {
    energyCost: Math.round(energyCost),
    machineCost: Math.round(machineCost),
  };
}

export function calcWashSupplyCost(
  settings: GeneralSettings,
  supplies: Supply[],
  productType: ProductType = ProductType.RESINA,
): number {
  const washProfile = getMachineProfilesForProductType(
    settings,
    productType,
  ).find((profile) => profile.role === MachineProfileRole.WASH);

  if (!washProfile?.washSupplyId) return 0;

  const consumptionMl = Math.max(Number(washProfile.consumptionMl) || 0, 0);
  if (consumptionMl <= 0) return 0;

  const supply = supplies.find((item) => item.id === washProfile.washSupplyId);
  if (!supply) return 0;

  const unitPrice = Number(supply.unitPrice) || 0;
  if (unitPrice <= 0) return 0;

  const bathUses = resolveWashBathUses(washProfile.washBathUses);

  let batchCost = 0;
  if (supply.unit === 'L') {
    batchCost = (consumptionMl / 1000) * unitPrice;
  } else if (supply.unit === 'ml') {
    batchCost = consumptionMl * unitPrice;
  } else {
    batchCost = (consumptionMl / 1000) * unitPrice;
  }

  return batchCost / bathUses;
}
