import {
  Product,
  Product3D,
  ProductEstampado,
  ProductPricingInput,
  ProductType,
} from '../../core/models';
import { normalizeProductComponents } from './product.helpers';
import { normalizeFdmFilaments } from './fdm.helpers';

/** Convierte un producto del catálogo al input de pricing (paridad con backend). */
export function productToPricingInput(
  product: Product,
  catalog: Product[],
): ProductPricingInput {
  const components = normalizeProductComponents(product.components ?? [], catalog);

  if (product.type === ProductType.COMBO) {
    return {
      type: ProductType.COMBO,
      components,
      assemblyTimeHours: product.assemblyTimeHours ?? 0,
      price: product.price,
      cost: product.cost,
    };
  }

  if (product.type === ProductType.ESTAMPADO) {
    const estampado = product as ProductEstampado;
    return {
      type: ProductType.ESTAMPADO,
      components,
      assemblyTimeHours: product.assemblyTimeHours ?? 0,
      price: product.price,
      cost: product.cost,
      workTimeHours: estampado.workTimeHours,
      estampadoPrints: estampado.prints ?? [],
      estampadoPressCycles: estampado.pressCycles ?? [],
      estampadoSupplies: estampado.supplies ?? [],
    };
  }

  const product3d = product as Product3D;
  const filaments =
    product3d.type === ProductType.FDM
      ? normalizeFdmFilaments(product3d.filaments, {
          grams: product3d.grams,
          filamentType: product3d.filamentType,
          brand: product3d.brand,
        })
      : [];

  return {
    type: product3d.type,
    components,
    assemblyTimeHours: product.assemblyTimeHours ?? 0,
    price: product.price,
    cost: product.cost,
    grams: product3d.grams,
    printTimeHours: product3d.printTimeHours,
    workTimeHours: product3d.workTimeHours,
    brand: product3d.brand,
    filamentType: product3d.filamentType,
    filaments,
    resinType: product3d.resinType,
    washMinutes: product3d.washMinutes,
    cureMinutes: product3d.cureMinutes,
  };
}

export function toProductPricingFields(
  product: Pick<Product, 'id' | 'price' | 'cost' | 'profit' | 'updatedAt'>,
) {
  return {
    id: product.id,
    price: product.price,
    cost: product.cost,
    profit: product.profit,
    updatedAt: product.updatedAt,
  };
}
