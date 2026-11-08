import { SettingsService } from './settings.service';
import { StoreService } from '../store/store.service';
import { StorePersistenceService } from '../store/store-persistence.service';
import { StoreChangeService } from '../store/store-change.service';
import { GeneralSettings } from '../common/interfaces';
import { MachineProfileRole, ProductType, ServiceType } from '../common/enums';
import { normalizePaperReferenceSheets } from '../common/paper-cost.util';
import { DEFAULT_WHOLESALE_DISCOUNT } from './wholesale-discount.util';
import {
  mapSettingsFromDb,
  mapSettingsToDb,
} from '../store/mappers/settings.mapper';

describe('SettingsService.patchGeneralSettings', () => {
  const baseSettings = (): GeneralSettings => ({
    electricityCostPerKwh: 2500,
    laborCostPerHour: 1000,
    modelingRatePerHour: 0,
    graphicDesignRatePerHour: 0,
    errorMarginPercent: 30,
    profitMargins: {
      [ServiceType.IMPRESION_3D]: 350,
      [ServiceType.DISENO_GRAFICO]: 50,
      [ServiceType.MODELADO]: 50,
      [ServiceType.ESTAMPADO]: 35,
    },
    wholesaleDiscount: {
      ...DEFAULT_WHOLESALE_DISCOUNT,
      serviceTypes: [...DEFAULT_WHOLESALE_DISCOUNT.serviceTypes],
    },
    paperPricesPerSqm: {
      dtf: 0,
      dtfUv: 0,
      sublimacion: 2500,
    },
    paperReferenceSheets: normalizePaperReferenceSheets(undefined, {
      dtf: 0,
      dtfUv: 0,
      sublimacion: 2500,
    }),
    powerConsumptions: [],
    machineCosts: [],
    machineProfiles: [],
    filamentPrices: [],
    resinPrices: [],
    filamentTypeAverages: {},
    resinTypeAverages: {},
    colors: [],
    filamentTypes: [],
    resinTypes: [],
  });

  function createService(initial: GeneralSettings): SettingsService {
    const store = {
      generalSettings: structuredClone(initial),
      supplies: [],
      nextId: (prefix: string, items: { id: string }[]) => {
        const max = items.reduce((acc, item) => {
          const match = item.id.match(new RegExp(`^${prefix}-(\\d+)$`));
          return match ? Math.max(acc, Number(match[1])) : acc;
        }, 0);
        return `${prefix}-${max + 1}`;
      },
    } as unknown as StoreService;
    const persistence = {} as StorePersistenceService;
    const storeChange = {
      recordChange: jest.fn(),
    } as unknown as StoreChangeService;

    const config = {
      databaseResetCode: undefined as string | undefined,
    } as unknown as import('../config/app-config.service').AppConfigService;

    return new SettingsService(store, persistence, storeChange, config);
  }

  it('no borra core values al actualizar solo paperPricesPerSqm', () => {
    const service = createService(baseSettings());

    const result = service.patchGeneralSettings({
      paperPricesPerSqm: {
        dtf: 0,
        dtfUv: 0,
        sublimacion: 5000,
      },
    });

    expect(result.electricityCostPerKwh).toBe(2500);
    expect(result.laborCostPerHour).toBe(1000);
    expect(result.errorMarginPercent).toBe(30);
    expect(result.paperPricesPerSqm.sublimacion).toBe(5000);
  });

  it('agrega, actualiza y elimina colores del catálogo', () => {
    const service = createService(baseSettings());

    const created = service.addColor({ name: 'Negro', hex: '#000000' });
    expect(created.id).toBeTruthy();
    expect(service.getGeneralSettings().colors).toHaveLength(1);

    const updated = service.updateColor(created.id, { name: 'Negro intenso' });
    expect(updated.name).toBe('Negro intenso');

    service.removeColor(created.id);
    expect(service.getGeneralSettings().colors).toHaveLength(0);
  });

  it('crea tipo de filamento y lo usa al guardar precio', () => {
    const service = createService(baseSettings());

    const typed = service.addFilamentType({ name: 'Woodfill' });
    expect(typed.id).toBeTruthy();
    expect(service.getGeneralSettings().filamentTypes).toHaveLength(1);

    const price = service.addFilamentPrice({
      brand: 'TestBrand',
      filamentTypeId: typed.id,
      pricePerKg: 12000,
    } as never);
    expect(price.filamentTypeId).toBe(typed.id);
    expect(price.materialType).toBe('woodfill');

    expect(() => service.removeFilamentType(typed.id)).toThrow();
    service.removeFilamentPrice(price.id);
    service.removeFilamentType(typed.id);
    expect(service.getGeneralSettings().filamentTypes).toHaveLength(0);
  });

  it('conserva campos nuevos de machine profile en PATCH y roundtrip DB', () => {
    const service = createService(baseSettings());
    const created = service.addMachineProfile({
      name: 'A1 #1',
      role: MachineProfileRole.PRINT,
      watts: 120,
      costPerHour: 150,
      productType: ProductType.FDM,
    });

    const patched = service.updateMachineProfile(created.id, {
      queueEnabled: true,
      costBase: true,
      workHoursPerDay: 14,
      workWeekdays: [1, 2, 3, 4, 5],
      workStartHour: '09:30',
      amsType: 'AMS lite',
      amsSlots: ['color-1', null, 'color-2', null],
    });

    expect(patched.queueEnabled).toBe(true);
    expect(patched.costBase).toBe(true);
    expect(patched.workHoursPerDay).toBe(14);
    expect(patched.workWeekdays).toEqual([1, 2, 3, 4, 5]);
    expect(patched.workStartHour).toBe('09:30');
    expect(patched.amsType).toBe('AMS lite');
    expect(patched.amsSlots).toEqual(['color-1', null, 'color-2', null]);

    const fromGet = service
      .getGeneralSettings()
      .machineProfiles.find((profile) => profile.id === created.id);
    expect(fromGet?.queueEnabled).toBe(true);
    expect(fromGet?.costBase).toBe(true);
    expect(fromGet?.workHoursPerDay).toBe(14);
    expect(fromGet?.workWeekdays).toEqual([1, 2, 3, 4, 5]);
    expect(fromGet?.workStartHour).toBe('09:30');
    expect(fromGet?.amsType).toBe('AMS lite');
    expect(fromGet?.amsSlots).toEqual(['color-1', null, 'color-2', null]);

    const dbRow = mapSettingsToDb(service.getGeneralSettings());
    const roundTrip = mapSettingsFromDb({
      electricityCostPerKwh: dbRow.electricityCostPerKwh,
      laborCostPerHour: dbRow.laborCostPerHour,
      modelingRatePerHour: dbRow.modelingRatePerHour,
      graphicDesignRatePerHour: dbRow.graphicDesignRatePerHour,
      errorMarginPercent: dbRow.errorMarginPercent,
      profitMargins: dbRow.profitMargins as never,
      wholesaleDiscount: dbRow.wholesaleDiscount as never,
      paperPricesPerSqm: dbRow.paperPricesPerSqm as never,
      paperReferenceSheets: dbRow.paperReferenceSheets as never,
      powerConsumptions: dbRow.powerConsumptions as never,
      machineCosts: dbRow.machineCosts as never,
      processProfiles: dbRow.processProfiles as never,
      filamentPrices: dbRow.filamentPrices as never,
      resinPrices: dbRow.resinPrices as never,
      filamentTypeAverages: dbRow.filamentTypeAverages as never,
      resinTypeAverages: dbRow.resinTypeAverages as never,
      colors: dbRow.colors as never,
      filamentTypes: dbRow.filamentTypes as never,
      resinTypes: dbRow.resinTypes as never,
    });

    const fromDb = roundTrip.machineProfiles.find(
      (profile) => profile.id === created.id,
    );
    expect(fromDb?.queueEnabled).toBe(true);
    expect(fromDb?.costBase).toBe(true);
    expect(fromDb?.workHoursPerDay).toBe(14);
    expect(fromDb?.workWeekdays).toEqual([1, 2, 3, 4, 5]);
    expect(fromDb?.workStartHour).toBe('09:30');
    expect(fromDb?.amsType).toBe('AMS lite');
    expect(fromDb?.amsSlots).toEqual(['color-1', null, 'color-2', null]);
  });
});

describe('SettingsService.updateWholesaleDiscount', () => {
  const baseSettings = (): GeneralSettings => ({
    electricityCostPerKwh: 2500,
    laborCostPerHour: 1000,
    modelingRatePerHour: 0,
    graphicDesignRatePerHour: 0,
    errorMarginPercent: 30,
    profitMargins: {
      [ServiceType.IMPRESION_3D]: 350,
      [ServiceType.DISENO_GRAFICO]: 50,
      [ServiceType.MODELADO]: 50,
      [ServiceType.ESTAMPADO]: 35,
    },
    wholesaleDiscount: {
      ...DEFAULT_WHOLESALE_DISCOUNT,
      serviceTypes: [...DEFAULT_WHOLESALE_DISCOUNT.serviceTypes],
    },
    paperPricesPerSqm: {
      dtf: 0,
      dtfUv: 0,
      sublimacion: 2500,
    },
    paperReferenceSheets: normalizePaperReferenceSheets(undefined, {
      dtf: 0,
      dtfUv: 0,
      sublimacion: 2500,
    }),
    powerConsumptions: [],
    machineCosts: [],
    machineProfiles: [],
    filamentPrices: [],
    resinPrices: [],
    filamentTypeAverages: {},
    resinTypeAverages: {},
    colors: [],
    filamentTypes: [],
    resinTypes: [],
  });

  function createService(initial: GeneralSettings): SettingsService {
    const store = {
      generalSettings: structuredClone(initial),
      supplies: [],
      nextId: (prefix: string, items: { id: string }[]) => {
        const max = items.reduce((acc, item) => {
          const match = item.id.match(new RegExp(`^${prefix}-(\\d+)$`));
          return match ? Math.max(acc, Number(match[1])) : acc;
        }, 0);
        return `${prefix}-${max + 1}`;
      },
    } as unknown as StoreService;
    const persistence = {} as StorePersistenceService;
    const storeChange = {
      recordChange: jest.fn(),
    } as unknown as StoreChangeService;

    const config = {
      databaseResetCode: undefined as string | undefined,
    } as unknown as import('../config/app-config.service').AppConfigService;

    return new SettingsService(store, persistence, storeChange, config);
  }

  it('actualiza el descuento por mayor', () => {
    const service = createService(baseSettings());

    const result = service.updateWholesaleDiscount({
      enabled: false,
      percent: 15,
      serviceTypes: [ServiceType.ESTAMPADO],
    });

    expect(result).toEqual({
      enabled: false,
      percent: 15,
      serviceTypes: [ServiceType.ESTAMPADO],
    });
    expect(service.getGeneralSettings().wholesaleDiscount).toEqual(result);
  });

  it('conserva lo guardado cuando una clave llega sin valor', () => {
    const service = createService(baseSettings());
    service.updateWholesaleDiscount({ enabled: false, percent: 15 });

    const result = service.updateWholesaleDiscount({
      enabled: undefined,
      percent: 25,
    });

    expect(result.enabled).toBe(false);
    expect(result.percent).toBe(25);
  });

  it('rechaza percent fuera de 0–99', () => {
    const service = createService(baseSettings());

    expect(() => service.updateWholesaleDiscount({ percent: 100 })).toThrow(
      'El descuento por mayor debe estar entre 0 y 99',
    );
    expect(() => service.updateWholesaleDiscount({ percent: -1 })).toThrow(
      'El descuento por mayor debe estar entre 0 y 99',
    );
  });
});
