import { Impreso } from '../../common/interfaces';

export function mapImpresoFromDb(row: {
  id: string;
  name: string;
  paperType: string;
  widthCm: number;
  heightCm: number;
  updatedAt: Date;
}): Impreso {
  return {
    id: row.id,
    name: row.name,
    paperType: row.paperType as Impreso['paperType'],
    widthCm: row.widthCm,
    heightCm: row.heightCm,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function mapImpresoToDb(impreso: Impreso) {
  return {
    id: impreso.id,
    name: impreso.name,
    paperType: impreso.paperType,
    widthCm: impreso.widthCm,
    heightCm: impreso.heightCm,
    updatedAt: new Date(impreso.updatedAt),
  };
}
