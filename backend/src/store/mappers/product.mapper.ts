import { Prisma } from '@prisma/client';
import {
  Product,
  Product3D,
  ProductCombo,
  ProductEstampado,
} from '../../common/interfaces';
import { ProductType } from '../../common/enums';
import { fromJson, toInputJson } from '../../prisma/json.util';
import {
  normalizeEstampadoPressCycles,
  normalizeEstampadoPrints,
  normalizeEstampadoSupplies,
} from '../../products/estampado-product.util';
import { normalizeProductComponents } from '../../products/product-component.util';

export function mapProductFromDb(row: {
  id: string;
  name: string;
  images: Prisma.JsonValue;
  updatedAt: Date;
  price: number;
  cost: number;
  profit: number;
  categoryIds: Prisma.JsonValue;
  type: string;
  size: string;
  published: boolean;
  includesPieces?: boolean;
  components: Prisma.JsonValue;
  assemblyTimeHours: number;
  grams: number | null;
  printTimeHours: number | null;
  workTimeHours: number | null;
  brand: string | null;
  filamentType: string | null;
  resinType: string | null;
  washMinutes: number | null;
  cureMinutes: number | null;
  pressMinutes: number | null;
  paperType: string | null;
  impresoId: string | null;
  widthCm: number | null;
  heightCm: number | null;
  estampadoPrints?: Prisma.JsonValue;
  estampadoPressCycles?: Prisma.JsonValue;
  estampadoSupplies?: Prisma.JsonValue;
}): Product {
  const components = normalizeProductComponents(fromJson(row.components));
  const base = {
    id: row.id,
    name: row.name,
    images: fromJson<string[]>(row.images) ?? [],
    updatedAt: row.updatedAt.toISOString(),
    price: row.price,
    cost: row.cost,
    profit: row.profit,
    categoryIds: fromJson<Product['categoryIds']>(row.categoryIds),
    type: row.type as Product['type'],
    size: row.size,
    published: row.published,
    includesPieces:
      row.includesPieces === true ||
      components.length > 0 ||
      row.type === ProductType.COMBO,
    components,
    assemblyTimeHours: row.assemblyTimeHours,
  };

  if (row.type === ProductType.COMBO) {
    return {
      ...base,
      type: ProductType.COMBO,
      includesPieces: true,
    } as ProductCombo;
  }

  if (row.type === ProductType.ESTAMPADO) {
    const legacy = {
      paperType: (row.paperType as ProductEstampado['paperType']) ?? undefined,
      impresoId: row.impresoId ?? undefined,
      widthCm: row.widthCm ?? undefined,
      heightCm: row.heightCm ?? undefined,
    };
    return {
      ...base,
      workTimeHours: row.workTimeHours ?? undefined,
      prints: normalizeEstampadoPrints(
        fromJson<ProductEstampado['prints']>(row.estampadoPrints ?? []),
        legacy,
      ),
      pressCycles: normalizeEstampadoPressCycles(
        fromJson<ProductEstampado['pressCycles']>(row.estampadoPressCycles ?? []),
        row.pressMinutes ?? undefined,
      ),
      supplies: normalizeEstampadoSupplies(
        fromJson<ProductEstampado['supplies']>(row.estampadoSupplies ?? []),
      ),
    } as ProductEstampado;
  }

  return {
    ...base,
    grams: row.grams ?? 0,
    printTimeHours: row.printTimeHours ?? 0,
    workTimeHours: row.workTimeHours ?? 0,
    washMinutes: row.washMinutes ?? undefined,
    cureMinutes: row.cureMinutes ?? undefined,
    brand: row.brand ?? undefined,
    filamentType: row.filamentType as Product3D['filamentType'],
    resinType: row.resinType as Product3D['resinType'],
  } as Product;
}

export function mapProductToDb(product: Product) {
  const estampado =
    product.type === ProductType.ESTAMPADO ? (product as ProductEstampado) : null;
  const isCombo = product.type === ProductType.COMBO;

  return {
    id: product.id,
    name: product.name,
    images: toInputJson(product.images),
    updatedAt: new Date(product.updatedAt),
    price: product.price,
    cost: product.cost,
    profit: product.profit,
    categoryIds: toInputJson(product.categoryIds),
    type: product.type,
    size: product.size,
    published: product.published !== false,
    includesPieces:
      isCombo || product.includesPieces === true || product.components.length > 0,
    components: toInputJson(product.components),
    assemblyTimeHours: product.assemblyTimeHours,
    grams: !isCombo && 'grams' in product ? product.grams : null,
    printTimeHours:
      !isCombo && 'printTimeHours' in product ? product.printTimeHours : null,
    workTimeHours:
      !isCombo && 'workTimeHours' in product ? product.workTimeHours : null,
    brand: !isCombo && 'brand' in product ? (product.brand ?? null) : null,
    filamentType:
      !isCombo && 'filamentType' in product ? (product.filamentType ?? null) : null,
    resinType:
      !isCombo && 'resinType' in product ? (product.resinType ?? null) : null,
    washMinutes:
      !isCombo && 'washMinutes' in product ? (product.washMinutes ?? null) : null,
    cureMinutes:
      !isCombo && 'cureMinutes' in product ? (product.cureMinutes ?? null) : null,
    pressMinutes: null,
    paperType: null,
    impresoId: null,
    widthCm: null,
    heightCm: null,
    estampadoPrints: toInputJson(estampado?.prints ?? []),
    estampadoPressCycles: toInputJson(estampado?.pressCycles ?? []),
    estampadoSupplies: toInputJson(estampado?.supplies ?? []),
  };
}
