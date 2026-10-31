import { BadRequestException, NotFoundException } from '@nestjs/common';
import { assertNonNegativeNumber } from '../common/validators/domain.validators';
import {
  GeneralSettings,
  MachineCostConfig,
  MachineProfile,
  PowerConsumptionConfig,
} from '../common/interfaces';
import { ensureMachineProfiles, normalizeMachineProfiles } from './machine-profile.util';

export function addMachineProfile(
  settings: GeneralSettings,
  data: Omit<MachineProfile, 'id'>,
  nextId: (prefix: string, list: { id: string }[]) => string,
  onChange: () => void,
): MachineProfile {
  const profiles = ensureMachineProfiles(settings);
  const normalized = normalizeMachineProfiles([
    {
      id: 'tmp',
      ...data,
    },
  ]);
  if (normalized.length === 0) {
    throw new BadRequestException('El perfil de máquina debe tener nombre');
  }

  const entry: MachineProfile = {
    ...normalized[0],
    id: nextId('mp', profiles),
  };
  settings.machineProfiles = [...profiles, entry];
  onChange();
  return structuredClone(entry);
}

export function updateMachineProfile(
  settings: GeneralSettings,
  id: string,
  data: Partial<Omit<MachineProfile, 'id'>>,
  onChange: () => void,
): MachineProfile {
  const profiles = ensureMachineProfiles(settings);
  const index = profiles.findIndex((profile) => profile.id === id);
  if (index === -1) {
    throw new NotFoundException('Perfil de máquina no encontrado');
  }

  const merged = normalizeMachineProfiles([
    {
      ...profiles[index],
      ...data,
      id,
    },
  ]);
  if (merged.length === 0) {
    throw new BadRequestException('El perfil de máquina debe tener nombre');
  }

  profiles[index] = merged[0];
  settings.machineProfiles = profiles;
  onChange();
  return structuredClone(profiles[index]);
}

export function removeMachineProfile(
  settings: GeneralSettings,
  id: string,
  onChange: () => void,
): void {
  const profiles = ensureMachineProfiles(settings);
  const exists = profiles.some((profile) => profile.id === id);
  if (!exists) {
    throw new NotFoundException('Perfil de máquina no encontrado');
  }

  settings.machineProfiles = profiles.filter(
    (profile) => profile.id !== id,
  );
  onChange();
}

export function addPowerConsumption(
  settings: GeneralSettings,
  data: Omit<PowerConsumptionConfig, 'id'>,
  nextId: (prefix: string, list: { id: string }[]) => string,
  onChange: () => void,
): PowerConsumptionConfig {
  const entry: PowerConsumptionConfig = {
    id: nextId('pw', settings.powerConsumptions),
    ...data,
  };
  settings.powerConsumptions.push(entry);
  onChange();
  return entry;
}

export function updatePowerConsumption(
  settings: GeneralSettings,
  id: string,
  data: Partial<Omit<PowerConsumptionConfig, 'id'>>,
  onChange: () => void,
): PowerConsumptionConfig {
  if (data.watts !== undefined) {
    assertNonNegativeNumber(data.watts, 'watts');
  }
  const index = settings.powerConsumptions.findIndex(
    (p) => p.id === id,
  );
  if (index === -1) {
    throw new NotFoundException('Consumo eléctrico no encontrado');
  }
  settings.powerConsumptions[index] = {
    ...settings.powerConsumptions[index],
    ...data,
  };
  onChange();
  return settings.powerConsumptions[index];
}

export function removePowerConsumption(
  settings: GeneralSettings,
  id: string,
  onChange: () => void,
): void {
  settings.powerConsumptions =
    settings.powerConsumptions.filter((p) => p.id !== id);
  onChange();
}

export function addMachineCost(
  settings: GeneralSettings,
  data: Omit<MachineCostConfig, 'id'>,
  nextId: (prefix: string, list: { id: string }[]) => string,
  onChange: () => void,
): MachineCostConfig {
  const entry: MachineCostConfig = {
    id: nextId('mc', settings.machineCosts),
    ...data,
  };
  settings.machineCosts.push(entry);
  onChange();
  return entry;
}

export function updateMachineCost(
  settings: GeneralSettings,
  id: string,
  data: Partial<Omit<MachineCostConfig, 'id'>>,
  onChange: () => void,
): MachineCostConfig {
  if (data.costPerHour !== undefined) {
    assertNonNegativeNumber(data.costPerHour, 'costPerHour');
  }
  const index = settings.machineCosts.findIndex(
    (m) => m.id === id,
  );
  if (index === -1) {
    throw new NotFoundException('Costo de máquina no encontrado');
  }
  settings.machineCosts[index] = {
    ...settings.machineCosts[index],
    ...data,
  };
  onChange();
  return settings.machineCosts[index];
}

export function removeMachineCost(
  settings: GeneralSettings,
  id: string,
  onChange: () => void,
): void {
  settings.machineCosts =
    settings.machineCosts.filter((m) => m.id !== id);
  onChange();
}
