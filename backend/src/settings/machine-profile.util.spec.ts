import { MachineProfileRole, ProductType } from '../common/enums';
import {
  calcWashSupplyCost,
  createDefaultMachineProfiles,
  getMachineProfilesForProductType,
  resolveMachineHours,
  resolveWashBathUses,
} from './machine-profile.util';

describe('machine-profile.util', () => {
  const settings = {
    electricityCostPerKwh: 100,
    laborCostPerHour: 500,
    powerConsumptions: [],
    machineCosts: [],
    profitMargins: { impresion_3d: 0, diseno: 0, estampado: 0 },
    paperPricesPerSqm: { sublimacion: 0, dtf: 0, dtfUv: 0 },
    filamentPrices: [],
    resinPrices: [],
    machineProfiles: createDefaultMachineProfiles().map((profile) =>
      profile.id === 'mp-res-wash'
        ? { ...profile, washSupplyId: 'sup-alcohol', washBathUses: 10 }
        : profile,
    ),
  };

  const supplies = [
    {
      id: 'sup-alcohol',
      name: 'Alcohol isopropílico',
      type: 'alcohol' as never,
      unit: 'L',
      quantity: 2,
      minStock: 0.5,
      unitPrice: 5000,
      priceFromSettings: false,
      updatedAt: new Date().toISOString(),
    },
  ];

  it('calcula horas de impresión FDM', () => {
    const profile = settings.machineProfiles.find(
      (p) => p.productType === ProductType.FDM,
    )!;
    const hours = resolveMachineHours(profile, { printTimeHours: 2 });
    expect(hours).toBe(2);
  });

  it('aplica perfil universal a cualquier tipo', () => {
    const universal = {
      id: 'mp-universal',
      name: 'Torno',
      role: MachineProfileRole.PRINT,
      watts: 100,
      costPerHour: 100,
    };
    const settingsWithUniversal = {
      ...settings,
      machineProfiles: [...settings.machineProfiles, universal],
    };
    const matches = getMachineProfilesForProductType(
      settingsWithUniversal,
      ProductType.FDM,
    );
    expect(matches.some((p) => p.id === 'mp-universal')).toBe(true);
  });

  it('resolveWashBathUses usa 10 por defecto', () => {
    expect(resolveWashBathUses()).toBe(10);
    expect(resolveWashBathUses(0)).toBe(10);
    expect(resolveWashBathUses(5)).toBe(5);
  });

  it('calcula costo de insumo de lavado amortizado por usos del baño', () => {
    const cost = calcWashSupplyCost(settings, supplies, ProductType.RESINA);
    // 80 ml × $5000/L = $400 por baño ÷ 10 usos = $40 por pieza
    expect(cost).toBe(40);
  });

  it('usa 10 usos cuando washBathUses es 0', () => {
    const settingsWithZero = {
      ...settings,
      machineProfiles: settings.machineProfiles.map((profile) =>
        profile.id === 'mp-res-wash'
          ? { ...profile, washBathUses: 0 }
          : profile,
      ),
    };
    const cost = calcWashSupplyCost(settingsWithZero, supplies, ProductType.RESINA);
    expect(cost).toBe(40);
  });

  it('respeta washBathUses personalizado', () => {
    const settingsWithFive = {
      ...settings,
      machineProfiles: settings.machineProfiles.map((profile) =>
        profile.id === 'mp-res-wash'
          ? { ...profile, washBathUses: 5 }
          : profile,
      ),
    };
    const cost = calcWashSupplyCost(settingsWithFive, supplies, ProductType.RESINA);
    expect(cost).toBe(80);
  });
});
