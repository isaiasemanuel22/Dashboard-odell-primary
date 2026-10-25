import { BadRequestException } from '@nestjs/common';
import { BrandMaterialType, ProductType, SupplyCategory } from '../common/enums';
import {
  Brand,
  FdmFilamentLine,
  FilamentPriceConfig,
  Product,
  Product3D,
  ResinPriceConfig,
  Supply,
} from '../common/interfaces';
import { StoreService } from './store.service';
import { StoreState } from './store.state';

type BrandCarrier = { brandId?: string; brand?: string };

export function findBrandByName(
  brands: Brand[],
  name: string,
): Brand | undefined {
  const key = name.trim().toLowerCase();
  if (!key) return undefined;
  return brands.find((brand) => brand.name.toLowerCase() === key);
}

export function findBrandById(
  brands: Brand[],
  id: string | undefined,
): Brand | undefined {
  if (!id) return undefined;
  return brands.find((brand) => brand.id === id);
}

export function ensureBrand(
  store: StoreService,
  name: string,
  materialType?: BrandMaterialType,
): Brand {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new BadRequestException('La marca es obligatoria');
  }
  if (!store.brands) store.brands = [];

  const existing = findBrandByName(store.brands, trimmed);
  if (!existing) {
    const created: Brand = {
      id: store.nextId('br', store.brands),
      name: trimmed,
      materialTypes: materialType ? [materialType] : [],
      createdAt: new Date().toISOString(),
    };
    store.brands.push(created);
    return created;
  }

  if (materialType && !existing.materialTypes.includes(materialType)) {
    existing.materialTypes = [...existing.materialTypes, materialType];
  }
  return existing;
}

export function requireBrandForMaterial(
  store: StoreService,
  name: string | undefined,
  materialType: BrandMaterialType,
): Brand {
  const brand = name?.trim()
    ? findBrandByName(store.brands ?? [], name)
    : undefined;
  if (!brand || !brand.materialTypes.includes(materialType)) {
    throw new BadRequestException(
      materialType === BrandMaterialType.FILAMENT
        ? 'Seleccioná una marca de filamento cargada en Ajustes'
        : 'Seleccioná una marca de resina cargada en Ajustes',
    );
  }
  return brand;
}

function bindBrand(
  store: StoreService,
  entry: BrandCarrier,
  materialType?: BrandMaterialType,
): void {
  const name = entry.brand?.trim();
  if (!name) return;
  entry.brandId = ensureBrand(store, name, materialType).id;
}

export function adoptLegacyBrandNames(state: StoreState): void {
  if (!state.brands) state.brands = [];
  const store = {
    brands: state.brands,
    nextId(prefix: string, items: { id: string }[]) {
      const numbers = items
        .map((item) => parseInt(item.id.split('-')[1] ?? '0', 10))
        .filter((value) => !Number.isNaN(value));
      const next = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
      return `${prefix}-${next}`;
    },
  } as StoreService;

  for (const price of state.generalSettings.filamentPrices ?? []) {
    bindBrand(store, price, BrandMaterialType.FILAMENT);
  }
  for (const price of state.generalSettings.resinPrices ?? []) {
    bindBrand(store, price, BrandMaterialType.RESIN);
  }
  for (const supply of state.supplies) {
    bindBrand(store, supply, materialTypeForSupply(supply));
  }
  for (const product of state.products) {
    bindProductBrands(store, product);
  }
  hydrateBrandNames(state);
}

function materialTypeForSupply(supply: Supply): BrandMaterialType | undefined {
  if (supply.category === SupplyCategory.FDM) return BrandMaterialType.FILAMENT;
  if (supply.category === SupplyCategory.RESINA && supply.resinType) {
    return BrandMaterialType.RESIN;
  }
  return undefined;
}

function bindProductBrands(store: StoreService, product: Product): void {
  if (product.type !== ProductType.FDM && product.type !== ProductType.RESINA) {
    return;
  }
  const product3d = product as Product3D;
  bindBrand(
    store,
    product3d,
    product3d.type === ProductType.FDM
      ? BrandMaterialType.FILAMENT
      : BrandMaterialType.RESIN,
  );
  for (const line of product3d.filaments ?? []) {
    bindBrand(store, line, BrandMaterialType.FILAMENT);
  }
}

export function assignSupplyBrand(store: StoreService, supply: Supply): void {
  const named = supply.brand?.trim();
  if (supply.category === SupplyCategory.FDM) {
    const brand = requireBrandForMaterial(
      store,
      named,
      BrandMaterialType.FILAMENT,
    );
    supply.brandId = brand.id;
    supply.brand = brand.name;
    return;
  }
  if (supply.category === SupplyCategory.RESINA && supply.resinType) {
    const brand = requireBrandForMaterial(store, named, BrandMaterialType.RESIN);
    supply.brandId = brand.id;
    supply.brand = brand.name;
    return;
  }
  if (named) {
    const brand = ensureBrand(store, named);
    supply.brandId = brand.id;
    supply.brand = brand.name;
    return;
  }
  if (supply.brandId && findBrandById(store.brands ?? [], supply.brandId)) {
    supply.brand = findBrandById(store.brands, supply.brandId)?.name;
    return;
  }
  supply.brandId = undefined;
  supply.brand = undefined;
}

export function linkProductBrands(store: StoreService, product: Product): void {
  bindProductBrands(store, product);
  hydrateBrandNames({
    brands: store.brands,
    generalSettings: store.generalSettings,
    supplies: store.supplies,
    products: store.products,
  });
}

export function hydrateBrandNames(
  state: Pick<StoreState, 'brands' | 'generalSettings' | 'supplies' | 'products'>,
): void {
  const brands = state.brands ?? [];
  const apply = (entry: BrandCarrier): void => {
    const brand = findBrandById(brands, entry.brandId);
    if (brand) entry.brand = brand.name;
  };

  for (const price of state.generalSettings?.filamentPrices ?? []) apply(price);
  for (const price of state.generalSettings?.resinPrices ?? []) apply(price);
  for (const supply of state.supplies ?? []) apply(supply);
  for (const product of state.products ?? []) {
    if (product.type !== ProductType.FDM && product.type !== ProductType.RESINA) {
      continue;
    }
    const product3d = product as Product3D;
    apply(product3d);
    for (const line of product3d.filaments ?? []) apply(line);
  }
}

export function persistedFilamentPrice(
  price: FilamentPriceConfig,
): Omit<FilamentPriceConfig, 'brand'> {
  return {
    id: price.id,
    brandId: price.brandId,
    materialType: price.materialType,
    pricePerKg: price.pricePerKg,
  };
}

export function persistedResinPrice(
  price: ResinPriceConfig,
): Omit<ResinPriceConfig, 'brand'> {
  return {
    id: price.id,
    brandId: price.brandId,
    resinType: price.resinType,
    pricePerLiter: price.pricePerLiter,
  };
}

export function persistedFdmLine(
  line: FdmFilamentLine,
): Omit<FdmFilamentLine, 'brand'> {
  return {
    id: line.id,
    filamentType: line.filamentType,
    grams: line.grams,
    brandId: line.brandId,
    label: line.label,
    colorId: line.colorId,
  };
}

export function brandIsUsed(state: StoreState, brandId: string): boolean {
  if (
    state.generalSettings.filamentPrices.some((price) => price.brandId === brandId)
  ) {
    return true;
  }
  if (state.generalSettings.resinPrices.some((price) => price.brandId === brandId)) {
    return true;
  }
  if (state.supplies.some((supply) => supply.brandId === brandId)) return true;
  return state.products.some((product) => {
    if (product.type !== ProductType.FDM && product.type !== ProductType.RESINA) {
      return false;
    }
    const product3d = product as Product3D;
    if (product3d.brandId === brandId) return true;
    return (product3d.filaments ?? []).some((line) => line.brandId === brandId);
  });
}
