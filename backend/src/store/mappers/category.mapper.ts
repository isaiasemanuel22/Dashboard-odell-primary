import { Prisma } from '@prisma/client';
import { Category } from '../../common/interfaces';
import { fromJson, toInputJson } from '../../prisma/json.util';

export function mapCategoryFromDb(row: {
  id: string;
  name: string;
  productTypes: Prisma.JsonValue;
  createdAt: Date;
}): Category {
  return {
    id: row.id,
    name: row.name,
    productTypes: fromJson<Category['productTypes']>(row.productTypes),
    createdAt: row.createdAt.toISOString(),
  };
}

export function mapCategoryToDb(category: Category) {
  return {
    id: category.id,
    name: category.name,
    productTypes: toInputJson(category.productTypes),
    createdAt: new Date(category.createdAt),
  };
}
