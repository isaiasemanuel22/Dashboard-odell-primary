import { MachineProfileRole, ProductType } from '../common/enums';
import { GeneralSettings, Product, Supply } from '../common/interfaces';
import { normalizeEstampadoSupplies } from '../products/estampado-product.util';

/**
 * Cuenta productos cuyo costo usa el insumo de forma directa:
 * - estampado: línea con supplyId
 * - lavado de resina: washSupplyId del perfil WASH → todos los RESINA
 *
 * Filamento/resina de material no entran al costo vía el Supply del stock
 * (usan precios de Ajustes); en esos casos devolvemos 0.
 */
export function countProductsUsingSupply(
  products: Product[],
  supply: Pick<Supply, 'id'>,
  settings: Pick<GeneralSettings, 'machineProfiles'>,
): number {
  const washSupplyIds = new Set(
    (settings.machineProfiles ?? [])
      .filter((profile) => profile.role === MachineProfileRole.WASH)
      .map((profile) => profile.washSupplyId)
      .filter((id): id is string => Boolean(id)),
  );

  if (washSupplyIds.has(supply.id)) {
    return products.filter((product) => product.type === ProductType.RESINA)
      .length;
  }

  return products.filter((product) => {
    if (product.type !== ProductType.ESTAMPADO) {
      return false;
    }
    return normalizeEstampadoSupplies(product.supplies).some(
      (line) => line.supplyId === supply.id,
    );
  }).length;
}
