import { BrandMaterialType, FilamentType, SupplyCategory } from '../common/enums';
import { createEmptyState } from './store.seed';
import { adoptLegacyBrandNames, ensureBrand } from './brand-link.util';
import { StoreService } from './store.service';

describe('marcas', () => {
  it('une el mismo nombre y le suma los tipos de material', () => {
    const store = new StoreService();
    store.applyState(createEmptyState());

    const resin = ensureBrand(store, 'Hellbot', BrandMaterialType.RESIN);
    const filament = ensureBrand(store, 'hellbot', BrandMaterialType.FILAMENT);

    expect(filament.id).toBe(resin.id);
    expect(filament.materialTypes).toEqual([
      BrandMaterialType.RESIN,
      BrandMaterialType.FILAMENT,
    ]);
  });

  it('pasa los nombres viejos a la tabla', () => {
    const state = createEmptyState();
    state.generalSettings.filamentPrices = [
      {
        id: 'fp-1',
        brand: 'FilAr',
        materialType: FilamentType.PLA,
        pricePerKg: 18000,
      },
    ];
    state.supplies = [
      {
        id: 'sup-1',
        name: 'Polímero',
        category: SupplyCategory.GENERAL,
        brand: 'NostiAr',
        unit: 'unidad',
        quantity: 1,
        minStock: 0,
        unitPrice: 10,
        priceFromSettings: false,
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ];

    adoptLegacyBrandNames(state);

    const filar = state.brands.find((brand) => brand.name === 'FilAr');
    const nosti = state.brands.find((brand) => brand.name === 'NostiAr');
    expect(filar?.materialTypes).toEqual([BrandMaterialType.FILAMENT]);
    expect(nosti?.materialTypes).toEqual([]);
    expect(state.generalSettings.filamentPrices[0]?.brandId).toBe(filar?.id);
    expect(state.generalSettings.filamentPrices[0]?.brand).toBe('FilAr');
    expect(state.supplies[0]?.brandId).toBe(nosti?.id);
  });
});
