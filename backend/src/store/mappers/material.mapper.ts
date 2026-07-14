import { Material } from '../../common/interfaces';

export function mapMaterialFromDb(row: {
  id: string;
  name: string;
  type: string;
  quantity: number;
  unit: string;
  minStock: number;
  supplier: string;
}): Material {
  return {
    id: row.id,
    name: row.name,
    type: row.type as Material['type'],
    quantity: row.quantity,
    unit: row.unit,
    minStock: row.minStock,
    supplier: row.supplier,
  };
}

export function mapMaterialToDb(material: Material) {
  return {
    id: material.id,
    name: material.name,
    type: material.type,
    quantity: material.quantity,
    unit: material.unit,
    minStock: material.minStock,
    supplier: material.supplier,
  };
}
