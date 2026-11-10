import {
  GeneralSettings,
  MachineProfile,
  MachineProfileRole,
  ProductType,
  Supply,
} from '../../core/models';

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

const DEFAULT_WORK_HOURS_PER_DAY = 16;
const DEFAULT_WORK_WEEKDAYS = [1, 2, 3, 4, 5, 6];
const DEFAULT_WORK_START_HOUR = '08:00';

function normalizeWorkWeekdays(value?: number[]): number[] {
  if (!Array.isArray(value) || !value.length) return [...DEFAULT_WORK_WEEKDAYS];
  const unique = [
    ...new Set(
      value
        .map((day) => Number(day))
        .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6),
    ),
  ];
  return unique.length ? unique : [...DEFAULT_WORK_WEEKDAYS];
}

function normalizeWorkStartHour(value?: string): string {
  if (typeof value === 'string' && /^\d{2}:\d{2}$/.test(value.trim())) {
    return value.trim();
  }
  return DEFAULT_WORK_START_HOUR;
}

function normalizeAmsSlots(value?: (string | null)[]): (string | null)[] {
  const slots = Array.isArray(value) ? value.slice(0, 4) : [];
  while (slots.length < 4) slots.push(null);
  return slots.map((slot) => (slot ? String(slot) : null));
}

function costBaseKey(profile: MachineProfile): string {
  return `${profile.productType ?? '*'}`;
}

/** Deja un solo costBase=true por productType entre perfiles print. */
export function enforceSingleCostBase(
  profiles: MachineProfile[],
): MachineProfile[] {
  const claimed = new Set<string>();
  return profiles.map((profile) => {
    if (profile.role !== MachineProfileRole.PRINT || !profile.costBase) {
      return profile.costBase ? { ...profile, costBase: false } : profile;
    }
    const key = costBaseKey(profile);
    if (claimed.has(key)) {
      return { ...profile, costBase: false };
    }
    claimed.add(key);
    return profile;
  });
}

export function normalizeMachineProfiles(
  profiles: StoredMachineProfile[],
): MachineProfile[] {
  const normalized = profiles
    .filter((profile) => profile.name?.trim())
    .map((profile) => {
      const productType = resolveProfileProductType(profile);
      const base: MachineProfile = {
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

      if (profile.role !== MachineProfileRole.PRINT) {
        return base;
      }

      const workHours = Number(profile.workHoursPerDay);
      return {
        ...base,
        queueEnabled: !!profile.queueEnabled,
        workHoursPerDay:
          Number.isFinite(workHours) && workHours >= 1 && workHours <= 24
            ? workHours
            : DEFAULT_WORK_HOURS_PER_DAY,
        workWeekdays: normalizeWorkWeekdays(profile.workWeekdays),
        workStartHour: normalizeWorkStartHour(profile.workStartHour),
        amsType: profile.amsType?.trim() || undefined,
        amsSlots: normalizeAmsSlots(profile.amsSlots),
        costBase: !!profile.costBase,
      };
    });

  return enforceSingleCostBase(normalized);
}

/**
 * Perfil print usado para costear.
 * Si hay `preferredPrinterId` válido (perfil print del productType), usa ese;
 * si no («Cualquiera» o id inválido), `costBase` o el primero del productType.
 */
export function selectPrintProfileForCost(
  settings: GeneralSettings,
  productType: ProductType,
  preferredPrinterId?: string | null,
): MachineProfile | undefined {
  const prints = getMachineProfilesForProductType(settings, productType).filter(
    (profile) => profile.role === MachineProfileRole.PRINT,
  );
  const preferred = preferredPrinterId?.trim();
  if (preferred) {
    const match = prints.find((profile) => profile.id === preferred);
    if (match) return match;
  }
  return prints.find((profile) => profile.costBase) ?? prints[0];
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
  preferredPrinterId?: string | null,
): { energyCost: number; machineCost: number } {
  const all = getMachineProfilesForProductType(settings, productType);
  const printForCost = selectPrintProfileForCost(
    settings,
    productType,
    preferredPrinterId,
  );
  const profiles = all.filter((profile) => {
    if (profile.role !== MachineProfileRole.PRINT) return true;
    return printForCost ? profile.id === printForCost.id : false;
  });
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

/** Overhead (luz + máquina) de un solo rol — p. ej. PRINT / WASH / CURE en resina. */
export function calculateMachineOverheadForRole(
  settings: GeneralSettings,
  productType: ProductType,
  context: MachineTimeContext,
  role: MachineProfileRole,
  preferredPrinterId?: string | null,
): { energyCost: number; machineCost: number; total: number } {
  const profiles =
    role === MachineProfileRole.PRINT
      ? (() => {
          const selected = selectPrintProfileForCost(
            settings,
            productType,
            preferredPrinterId,
          );
          return selected ? [selected] : [];
        })()
      : getMachineProfilesForProductType(settings, productType).filter(
          (profile) => profile.role === role,
        );
  const costPerKwh = settings.electricityCostPerKwh;

  let energyCost = 0;
  let machineCost = 0;

  for (const profile of profiles) {
    const hours = resolveMachineHours(profile, context);
    energyCost += (profile.watts / 1000) * hours * costPerKwh;
    machineCost += profile.costPerHour * hours;
  }

  const energy = Math.round(energyCost);
  const machine = Math.round(machineCost);
  return {
    energyCost: energy,
    machineCost: machine,
    total: energy + machine,
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
