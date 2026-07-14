import { Prisma } from '@prisma/client';
import { Product, Product3D } from '../../common/interfaces';
import { fromJson, toInputJson } from '../../prisma/json.util';

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
}): Product {
  const base = {
    id: row.id,
    name: row.name,
    images: fromJson<Product['images']>(row.images),
    updatedAt: row.updatedAt.toISOString(),
    price: row.price,
    cost: row.cost,
    profit: row.profit,
    categoryIds: fromJson<Product['categoryIds']>(row.categoryIds),
    type: row.type as Product['type'],
    size: row.size,
    published: row.published,
    components: fromJson<Product['components']>(row.components),
    assemblyTimeHours: row.assemblyTimeHours,
  };

  if (row.type === 'estampado') {
    return {
      ...base,
      pressMinutes: row.pressMinutes ?? undefined,
      workTimeHours: row.workTimeHours ?? undefined,
    } as Product;
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
    components: toInputJson(product.components),
    assemblyTimeHours: product.assemblyTimeHours,
    grams: 'grams' in product ? product.grams : null,
    printTimeHours: 'printTimeHours' in product ? product.printTimeHours : null,
    workTimeHours: 'workTimeHours' in product ? product.workTimeHours : null,
    brand: 'brand' in product ? (product.brand ?? null) : null,
    filamentType:
      'filamentType' in product ? (product.filamentType ?? null) : null,
    resinType: 'resinType' in product ? (product.resinType ?? null) : null,
    washMinutes: 'washMinutes' in product ? (product.washMinutes ?? null) : null,
    cureMinutes: 'cureMinutes' in product ? (product.cureMinutes ?? null) : null,
    pressMinutes:
      'pressMinutes' in product ? (product.pressMinutes ?? null) : null,
  };
}
