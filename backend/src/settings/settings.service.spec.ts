import { SettingsService } from './settings.service';
import { StoreService } from '../store/store.service';
import { StorePersistenceService } from '../store/store-persistence.service';
import { StoreChangeService } from '../store/store-change.service';
import { GeneralSettings } from '../common/interfaces';
import { ServiceType } from '../common/enums';
import { normalizePaperReferenceSheets } from '../common/paper-cost.util';

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
    } as StoreService;
    const persistence = {} as StorePersistenceService;
    const storeChange = {
      recordChange: jest.fn(),
    } as unknown as StoreChangeService;

    return new SettingsService(store, persistence, storeChange);
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
});
