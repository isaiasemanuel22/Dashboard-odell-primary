import {
  MachineProfileRole,
  ProductType,
  SupplyCategory,
} from '../common/enums';
import { GeneralSettings, Supply } from '../common/interfaces';
import { normalizePaperReferenceSheets } from '../common/paper-cost.util';
import {
  calcWashSupplyCost,
  calculateMachineOverhead,
  createDefaultMachineProfiles,
  getMachineProfilesForProductType,
  normalizeMachineProfiles,
  profileHourlyCost,
  resolveMachineHours,
  resolveWashBathUses,
  selectPrintProfileForCost,
} from './machine-profile.util';

describe('machine-profile.util', () => {
  const settings: GeneralSettings = {
    electricityCostPerKwh: 100,
    laborCostPerHour: 500,
    modelingRatePerHour: 0,
    graphicDesignRatePerHour: 0,
    powerConsumptions: [],
    machineCosts: [],
    profitMargins: {
      impresion_3d: 0,
      diseno_grafico: 0,
      modelado: 0,
      estampado: 0,
    },
    wholesaleDiscount: {
      enabled: true,
      percent: 20,
      serviceTypes: [],
    },
    paperPricesPerSqm: { sublimacion: 0, dtf: 0, dtfUv: 0 },
    paperReferenceSheets: normalizePaperReferenceSheets(undefined, {
      sublimacion: 0,
      dtf: 0,
      dtfUv: 0,
    }),
    filamentPrices: [],
    resinPrices: [],
    errorMarginPercent: 0,
    filamentTypeAverages: {},
    resinTypeAverages: {},
    filamentTypes: [],
    resinTypes: [],
    colors: [],
    machineProfiles: createDefaultMachineProfiles().map((profile) =>
      profile.id === 'mp-res-wash'
        ? { ...profile, washSupplyId: 'sup-alcohol', washBathUses: 10 }
        : profile,
    ),
  };

  const supplies: Supply[] = [
    {
      id: 'sup-alcohol',
      name: 'Alcohol isopropílico',
      category: SupplyCategory.RESINA,
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

  it('profileHourlyCost suma luz y máquina sin redondear', () => {
    const profile = settings.machineProfiles.find(
      (p) => p.productType === ProductType.FDM,
    )!;
    const part = profileHourlyCost(settings, profile, 2);
    expect(part.energyCost).toBe((120 / 1000) * 2 * 100);
    expect(part.machineCost).toBe(150 * 2);
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
    const cost = calcWashSupplyCost(
      settingsWithZero,
      supplies,
      ProductType.RESINA,
    );
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
    const cost = calcWashSupplyCost(
      settingsWithFive,
      supplies,
      ProductType.RESINA,
    );
    expect(cost).toBe(80);
  });

  it('normaliza defaults de cola solo en role=print', () => {
    const [print, wash] = normalizeMachineProfiles([
      {
        id: 'a1',
        name: 'A1 #1',
        role: MachineProfileRole.PRINT,
        watts: 100,
        costPerHour: 100,
        productType: ProductType.FDM,
        queueEnabled: true,
      },
      {
        id: 'wash',
        name: 'Lavadora',
        role: MachineProfileRole.WASH,
        watts: 80,
        costPerHour: 80,
        productType: ProductType.RESINA,
        queueEnabled: true,
        workHoursPerDay: 10,
      },
    ]);
    expect(print.queueEnabled).toBe(true);
    expect(print.workHoursPerDay).toBe(16);
    expect(print.workWeekdays).toEqual([1, 2, 3, 4, 5, 6]);
    expect(print.workStartHour).toBe('08:00');
    expect(wash.queueEnabled).toBeUndefined();
    expect(wash.workHoursPerDay).toBeUndefined();
  });

  it('deja un solo costBase=true por productType al normalizar', () => {
    const normalized = normalizeMachineProfiles([
      {
        id: 'p1',
        name: 'A1 #1',
        role: MachineProfileRole.PRINT,
        watts: 100,
        costPerHour: 100,
        productType: ProductType.FDM,
        costBase: true,
      },
      {
        id: 'p2',
        name: 'A1 #2',
        role: MachineProfileRole.PRINT,
        watts: 120,
        costPerHour: 200,
        productType: ProductType.FDM,
        costBase: true,
      },
    ]);
    expect(normalized.filter((p) => p.costBase).map((p) => p.id)).toEqual([
      'p1',
    ]);
  });

  it('usa costBase para overhead de impresión con varios perfiles print', () => {
    const multi = {
      ...settings,
      electricityCostPerKwh: 100,
      machineProfiles: normalizeMachineProfiles([
        {
          id: 'cheap',
          name: 'Barata',
          role: MachineProfileRole.PRINT,
          watts: 1000,
          costPerHour: 100,
          productType: ProductType.FDM,
        },
        {
          id: 'base',
          name: 'Base',
          role: MachineProfileRole.PRINT,
          watts: 1000,
          costPerHour: 500,
          productType: ProductType.FDM,
          costBase: true,
        },
      ]),
    };
    expect(selectPrintProfileForCost(multi, ProductType.FDM)?.id).toBe('base');
    const overhead = calculateMachineOverhead(multi, ProductType.FDM, {
      printTimeHours: 1,
    });
    // 1 kW × 1 h × $100 + máquina $500
    expect(overhead.energyCost).toBe(100);
    expect(overhead.machineCost).toBe(500);
  });

  it('sin costBase usa el primer perfil print (comportamiento actual)', () => {
    const multi = {
      ...settings,
      machineProfiles: normalizeMachineProfiles([
        {
          id: 'first',
          name: 'Primera',
          role: MachineProfileRole.PRINT,
          watts: 1000,
          costPerHour: 100,
          productType: ProductType.FDM,
        },
        {
          id: 'second',
          name: 'Segunda',
          role: MachineProfileRole.PRINT,
          watts: 1000,
          costPerHour: 999,
          productType: ProductType.FDM,
        },
      ]),
    };
    expect(selectPrintProfileForCost(multi, ProductType.FDM)?.id).toBe('first');
  });

  it('con preferredPrinterId válido prioriza esa impresora sobre costBase', () => {
    const multi = {
      ...settings,
      electricityCostPerKwh: 100,
      machineProfiles: normalizeMachineProfiles([
        {
          id: 'a1-1',
          name: 'A1 #1',
          role: MachineProfileRole.PRINT,
          watts: 1000,
          costPerHour: 100,
          productType: ProductType.FDM,
          costBase: true,
        },
        {
          id: 'a1-2',
          name: 'A1 #2',
          role: MachineProfileRole.PRINT,
          watts: 2000,
          costPerHour: 300,
          productType: ProductType.FDM,
        },
      ]),
    };
    expect(
      selectPrintProfileForCost(multi, ProductType.FDM, 'a1-2')?.id,
    ).toBe('a1-2');
    const overhead = calculateMachineOverhead(
      multi,
      ProductType.FDM,
      { printTimeHours: 1 },
      'a1-2',
    );
    // 2 kW × 1 h × $100 + máquina $300
    expect(overhead.energyCost).toBe(200);
    expect(overhead.machineCost).toBe(300);
  });

  it('preferredPrinterId inválido cae a costBase', () => {
    const multi = {
      ...settings,
      machineProfiles: normalizeMachineProfiles([
        {
          id: 'a1-1',
          name: 'A1 #1',
          role: MachineProfileRole.PRINT,
          watts: 100,
          costPerHour: 100,
          productType: ProductType.FDM,
          costBase: true,
        },
        {
          id: 'a1-2',
          name: 'A1 #2',
          role: MachineProfileRole.PRINT,
          watts: 200,
          costPerHour: 200,
          productType: ProductType.FDM,
        },
      ]),
    };
    expect(
      selectPrintProfileForCost(multi, ProductType.FDM, 'no-existe')?.id,
    ).toBe('a1-1');
  });
});
