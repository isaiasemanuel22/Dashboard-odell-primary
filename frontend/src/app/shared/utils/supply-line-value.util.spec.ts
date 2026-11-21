import { SupplyCategory } from '../../core/models';
import {
  PACKAGING_PRICE_MULTIPLIER,
  catalogCostChangeIgnoringPackaging,
  isCatalogInsumo,
  isPackagingSupply,
  packagingPriceFromValue,
  suppliesForMode,
} from './supply-line-value.util';

describe('packaging (§27)', () => {
  it('el precio es valor × 1,25 redondeado, sin margen de error', () => {
    expect(PACKAGING_PRICE_MULTIPLIER).toBe(1.25);
    expect(packagingPriceFromValue(800)).toBe(1000);
    expect(packagingPriceFromValue(801)).toBe(1001);
    expect(packagingPriceFromValue(0)).toBe(0);
    expect(packagingPriceFromValue(Number.NaN)).toBe(0);
  });

  describe('selectores de insumos y packaging', () => {
    const all = [
      { id: 'g', category: SupplyCategory.GENERAL },
      { id: 'e', category: SupplyCategory.ESTAMPADO },
      { id: 'p', category: SupplyCategory.PACKAGING },
      { id: 'f', category: SupplyCategory.FDM },
    ];

    it('en «Insumos» no aparece el packaging', () => {
      expect(suppliesForMode(all, 'supplies').map((s) => s.id)).toEqual([
        'g',
        'e',
      ]);
      expect(suppliesForMode(all).some(isPackagingSupply)).toBeFalse();
    });

    it('en «Packaging» aparece solo el packaging', () => {
      expect(suppliesForMode(all, 'packaging').map((s) => s.id)).toEqual(['p']);
      expect(all.filter(isCatalogInsumo).some(isPackagingSupply)).toBeFalse();
    });
  });
});

describe('catalogCostChangeIgnoringPackaging (aviso de costo de la línea)', () => {
  it('quitar o cambiar el packaging de la línea no dispara el aviso', () => {
    // Producto: costo 5000 con packaging 1000. Línea sin packaging: 4000.
    expect(catalogCostChangeIgnoringPackaging(4000, 0, 5000, 1000)).toBeNull();
    // Línea con otro packaging (1500): 5500.
    expect(catalogCostChangeIgnoringPackaging(5500, 1500, 5000, 1000)).toBeNull();
  });

  it('un cambio real de costo avisa y conserva el packaging de la línea', () => {
    // Producto subió a 6000 (packaging igual); la línea quitó el packaging.
    expect(catalogCostChangeIgnoringPackaging(4000, 0, 6000, 1000)).toBe(5000);
  });

  it('sin costo de catálogo no avisa', () => {
    expect(catalogCostChangeIgnoringPackaging(100, 0, 0, 0)).toBeNull();
  });
});
