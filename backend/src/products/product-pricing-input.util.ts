import { ProductType } from '../common/enums';
import { Product, ProductPricingInput } from '../common/interfaces';
import {
  normalizeEstampadoPressCycles,
  normalizeEstampadoPrints,
  normalizeEstampadoSupplies,
} from './estampado-product.util';
import { normalizeFdmFilaments } from './fdm-product.util';
import { normalizeProductComponents } from './product-component.util';

/** Entrada de cálculo de un producto guardado (sin depender de servicios). */
export function productToPricingInput(
  product: Product,
  allProducts: Product[],
): ProductPricingInput {
  const components = normalizeProductComponents(
    product.components,
    allProducts,
  );

  if (product.type === ProductType.COMBO) {
    return {
      type: ProductType.COMBO,
      components,
      assemblyTimeHours: product.assemblyTimeHours ?? 0,
      suggestedPrice: product.suggestedPrice,
      price: product.price,
      cost: product.cost,
    };
  }

  if (product.type === ProductType.ESTAMPADO) {
    const estampado = product;
    return {
      type: ProductType.ESTAMPADO,
      components,
      assemblyTimeHours: product.assemblyTimeHours ?? 0,
      suggestedPrice: product.suggestedPrice,
      price: product.price,
      cost: product.cost,
      workTimeHours: estampado.workTimeHours,
      estampadoPrints: normalizeEstampadoPrints(estampado.prints),
      estampadoPressCycles: normalizeEstampadoPressCycles(
        estampado.pressCycles,
      ),
      estampadoSupplies: normalizeEstampadoSupplies(estampado.supplies),
    };
  }

  const product3d = product;
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
    suggestedPrice: product.suggestedPrice,
    price: product.price,
    cost: product.cost,
    grams: product3d.grams,
    purgeGrams:
      product3d.type === ProductType.FDM ? product3d.purgeGrams : undefined,
    printTimeHours: product3d.printTimeHours,
    workTimeHours: product3d.workTimeHours,
    brand: product3d.brand,
    filamentType: product3d.filamentType,
    filaments,
    resinType: product3d.resinType,
    washMinutes: product3d.washMinutes,
    cureMinutes: product3d.cureMinutes,
    estampadoSupplies: normalizeEstampadoSupplies(product3d.supplies),
    preferredPrinterId:
      product3d.type === ProductType.FDM
        ? product3d.preferredPrinterId
        : undefined,
  };
}
