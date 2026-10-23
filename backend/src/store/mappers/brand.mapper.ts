import { Prisma } from '@prisma/client';
import { BrandMaterialType } from '../../common/enums';
import { Brand } from '../../common/interfaces';
import { fromJson, toInputJson } from '../../prisma/json.util';

const MATERIAL_TYPES = new Set<string>(Object.values(BrandMaterialType));

export function mapBrandFromDb(row: {
  id: string;
  name: string;
  materialTypes: Prisma.JsonValue;
  createdAt: Date;
}): Brand {
  const raw = fromJson<unknown[]>(row.materialTypes);
  const materialTypes = raw.filter(
    (value): value is BrandMaterialType =>
      typeof value === 'string' && MATERIAL_TYPES.has(value),
  );
  return {
    id: row.id,
    name: row.name,
    materialTypes,
    createdAt: row.createdAt.toISOString(),
  };
}

export function mapBrandToDb(brand: Brand) {
  return {
    id: brand.id,
    name: brand.name,
    materialTypes: toInputJson(brand.materialTypes),
    createdAt: new Date(brand.createdAt),
  };
}
