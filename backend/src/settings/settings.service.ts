import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DATABASE_RESET_CODE } from '../common/dto';
import { StoreChangeService } from '../store/store-change.service';
import { StorePersistenceService } from '../store/store-persistence.service';
import {
  assertNonNegativeNumber,
} from '../common/validators/domain.validators';
import { ensureMachineProfiles } from './machine-profile.util';
import {
  FilamentPriceConfig,
  GeneralSettings,
  MachineCostConfig,
  PowerConsumptionConfig,
  ResinPriceConfig,
} from '../common/interfaces';
import { SupplyType } from '../common/enums';
import { StoreService } from '../store/store.service';

@Injectable()
export class SettingsService {
  constructor(
    private readonly store: StoreService,
    private readonly persistence: StorePersistenceService,
    private readonly storeChange: StoreChangeService,
  ) {}

  getGeneralSettings(): GeneralSettings {
    this.store.generalSettings.machineProfiles = ensureMachineProfiles(
      this.store.generalSettings,
    );
    return this.store.generalSettings;
  }

  updateGeneralSettings(data: Partial<GeneralSettings>): GeneralSettings {
    if (data.electricityCostPerKwh !== undefined) {
      assertNonNegativeNumber(data.electricityCostPerKwh, 'electricityCostPerKwh');
    }
    if (data.laborCostPerHour !== undefined) {
      assertNonNegativeNumber(data.laborCostPerHour, 'laborCostPerHour');
    }
    if (data.errorMarginPercent !== undefined) {
      const margin = Number(data.errorMarginPercent);
      if (!Number.isFinite(margin) || margin < 0 || margin > 100) {
        throw new BadRequestException(
          'El margen de error debe estar entre 0 y 100',
        );
      }
    }
    if (data.profitMargins) {
      for (const [key, value] of Object.entries(data.profitMargins)) {
        const margin = Number(value);
        if (!Number.isFinite(margin) || margin < 0 || margin > 99) {
          throw new BadRequestException(
            `Margen inválido para ${key}: debe estar entre 0 y 99`,
          );
        }
      }
    }
    if (data.filamentTypeAverages) {
      for (const [key, value] of Object.entries(data.filamentTypeAverages)) {
        assertNonNegativeNumber(value, `filamentTypeAverages.${key}`);
      }
    }
    if (data.resinTypeAverages) {
      for (const [key, value] of Object.entries(data.resinTypeAverages)) {
        assertNonNegativeNumber(value, `resinTypeAverages.${key}`);
      }
    }

    this.store.generalSettings = {
      ...this.store.generalSettings,
      ...data,
      paperPricesPerSqm: {
        ...this.store.generalSettings.paperPricesPerSqm,
        ...(data.paperPricesPerSqm ?? {}),
      },
      profitMargins: {
        ...this.store.generalSettings.profitMargins,
        ...(data.profitMargins ?? {}),
      },
      filamentTypeAverages: {
        ...this.store.generalSettings.filamentTypeAverages,
        ...(data.filamentTypeAverages ?? {}),
      },
      resinTypeAverages: {
        ...this.store.generalSettings.resinTypeAverages,
        ...(data.resinTypeAverages ?? {}),
      },
      machineProfiles:
        data.machineProfiles ??
        ensureMachineProfiles(this.store.generalSettings),
    };
    this.store.generalSettings.machineProfiles = ensureMachineProfiles(
      this.store.generalSettings,
    );
    return this.store.generalSettings;
  }

  addPowerConsumption(
    data: Omit<PowerConsumptionConfig, 'id'>,
  ): PowerConsumptionConfig {
    const entry: PowerConsumptionConfig = {
      id: this.store.nextId('pw', this.store.generalSettings.powerConsumptions),
      ...data,
    };
    this.store.generalSettings.powerConsumptions.push(entry);
    return entry;
  }

  updatePowerConsumption(
    id: string,
    data: Partial<Omit<PowerConsumptionConfig, 'id'>>,
  ): PowerConsumptionConfig {
    if (data.watts !== undefined) {
      assertNonNegativeNumber(data.watts, 'watts');
    }
    const index = this.store.generalSettings.powerConsumptions.findIndex(
      (p) => p.id === id,
    );
    if (index === -1) {
      throw new NotFoundException('Consumo eléctrico no encontrado');
    }
    this.store.generalSettings.powerConsumptions[index] = {
      ...this.store.generalSettings.powerConsumptions[index],
      ...data,
    };
    return this.store.generalSettings.powerConsumptions[index];
  }

  removePowerConsumption(id: string): void {
    this.store.generalSettings.powerConsumptions =
      this.store.generalSettings.powerConsumptions.filter((p) => p.id !== id);
  }

  addMachineCost(data: Omit<MachineCostConfig, 'id'>): MachineCostConfig {
    const entry: MachineCostConfig = {
      id: this.store.nextId('mc', this.store.generalSettings.machineCosts),
      ...data,
    };
    this.store.generalSettings.machineCosts.push(entry);
    return entry;
  }

  updateMachineCost(
    id: string,
    data: Partial<Omit<MachineCostConfig, 'id'>>,
  ): MachineCostConfig {
    if (data.costPerHour !== undefined) {
      assertNonNegativeNumber(data.costPerHour, 'costPerHour');
    }
    const index = this.store.generalSettings.machineCosts.findIndex(
      (m) => m.id === id,
    );
    if (index === -1) {
      throw new NotFoundException('Costo de máquina no encontrado');
    }
    this.store.generalSettings.machineCosts[index] = {
      ...this.store.generalSettings.machineCosts[index],
      ...data,
    };
    return this.store.generalSettings.machineCosts[index];
  }

  removeMachineCost(id: string): void {
    this.store.generalSettings.machineCosts =
      this.store.generalSettings.machineCosts.filter((m) => m.id !== id);
  }

  addFilamentPrice(
    data: Omit<FilamentPriceConfig, 'id'>,
  ): FilamentPriceConfig {
    const entry: FilamentPriceConfig = {
      id: this.store.nextId('fp', this.store.generalSettings.filamentPrices),
      ...data,
    };
    this.store.generalSettings.filamentPrices.push(entry);
    this.syncFilamentSupplies(entry);
    return entry;
  }

  updateFilamentPrice(
    id: string,
    data: Partial<Omit<FilamentPriceConfig, 'id'>>,
  ): FilamentPriceConfig {
    const index = this.store.generalSettings.filamentPrices.findIndex(
      (p) => p.id === id,
    );
    if (index === -1) {
      throw new NotFoundException('Precio de filamento no encontrado');
    }
    this.store.generalSettings.filamentPrices[index] = {
      ...this.store.generalSettings.filamentPrices[index],
      ...data,
    };
    const updated = this.store.generalSettings.filamentPrices[index];
    this.syncFilamentSupplies(updated);
    return updated;
  }

  removeFilamentPrice(id: string): void {
    this.store.generalSettings.filamentPrices =
      this.store.generalSettings.filamentPrices.filter((p) => p.id !== id);
  }

  addResinPrice(data: Omit<ResinPriceConfig, 'id'>): ResinPriceConfig {
    const entry: ResinPriceConfig = {
      id: this.store.nextId('rp', this.store.generalSettings.resinPrices),
      ...data,
    };
    this.store.generalSettings.resinPrices.push(entry);
    this.syncResinSupplies(entry);
    return entry;
  }

  updateResinPrice(
    id: string,
    data: Partial<Omit<ResinPriceConfig, 'id'>>,
  ): ResinPriceConfig {
    const index = this.store.generalSettings.resinPrices.findIndex(
      (p) => p.id === id,
    );
    if (index === -1) {
      throw new NotFoundException('Precio de resina no encontrado');
    }
    this.store.generalSettings.resinPrices[index] = {
      ...this.store.generalSettings.resinPrices[index],
      ...data,
    };
    const updated = this.store.generalSettings.resinPrices[index];
    this.syncResinSupplies(updated);
    return updated;
  }

  removeResinPrice(id: string): void {
    this.store.generalSettings.resinPrices =
      this.store.generalSettings.resinPrices.filter((p) => p.id !== id);
  }

  private syncFilamentSupplies(filamentPrice: FilamentPriceConfig): void {
    const now = new Date().toISOString();
    for (const supply of this.store.supplies) {
      if (
        supply.type === SupplyType.FILAMENTO &&
        supply.priceFromSettings &&
        supply.brand?.toLowerCase() === filamentPrice.brand.toLowerCase() &&
        supply.filamentType === filamentPrice.materialType
      ) {
        supply.unitPrice = filamentPrice.pricePerKg;
        supply.updatedAt = now;
      }
    }
  }

  private syncResinSupplies(resinPrice: ResinPriceConfig): void {
    const now = new Date().toISOString();
    for (const supply of this.store.supplies) {
      if (
        supply.type === SupplyType.RESINA &&
        supply.priceFromSettings &&
        supply.brand?.toLowerCase() === resinPrice.brand.toLowerCase() &&
        supply.resinType === resinPrice.resinType
      ) {
        supply.unitPrice = resinPrice.pricePerLiter;
        supply.updatedAt = now;
      }
    }
  }

  async resetDatabase(code: string): Promise<{ reset: true }> {
    if (code !== DATABASE_RESET_CODE) {
      throw new BadRequestException('Código de confirmación incorrecto');
    }

    await this.persistence.clearDatabase();
    this.storeChange.notifyAll('update');
    return { reset: true };
  }
}
