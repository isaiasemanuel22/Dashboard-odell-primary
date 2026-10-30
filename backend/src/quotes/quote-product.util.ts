import { ProductType, ServiceType } from '../common/enums';
import { Product, QuoteItem } from '../common/interfaces';
import { isDesignService } from '../common/service-type.util';
import {
  normalizeEstampadoPressCycles,
  normalizeEstampadoPrints,
  normalizeEstampadoSupplies,
} from '../products/estampado-product.util';
import {
  normalizeFdmFilaments,
  totalFdmFilamentGrams,
} from '../products/fdm-product.util';

export function isQuoteLineMissingFromCatalog(
  item: Pick<QuoteItem, 'serviceType' | 'productId'>,
  catalogHasProduct: (productId: string) => boolean,
): boolean {
  if (isDesignService(item.serviceType)) return false;
  const productId = item.productId?.trim();
  if (!productId) return true;
  return !catalogHasProduct(productId);
}

/** Producto no publicado. El nombre alcanza; el resto queda para editarlo. */
export function unpublishedProductFromQuoteLine(
  item: QuoteItem,
  id: string,
  updatedAt: string,
): Product | null {
  if (isDesignService(item.serviceType)) return null;

  const name = item.productName.trim();
  if (!name) return null;

  const price = persistedLinePrice(item.unitPrice);
  const base = {
    id,
    name,
    images: [] as string[],
    attachments: [],
    updatedAt,
    price,
    cost: 0,
    profit: price,
    categoryIds: [] as string[],
    size: '',
    published: false,
    includesPieces: false,
    components: [],
    assemblyTimeHours: 0,
    stock: 0,
  };

  if (item.serviceType === ServiceType.ESTAMPADO) {
    return {
      ...base,
      type: ProductType.ESTAMPADO,
      workTimeHours: Number(item.workTimeHours) || 0,
      prints: normalizeEstampadoPrints(item.estampadoPrints),
      pressCycles: normalizeEstampadoPressCycles(item.estampadoPressCycles),
      supplies: normalizeEstampadoSupplies(item.estampadoSupplies),
    };
  }

  const filaments = normalizeFdmFilaments(item.filaments, {
    grams: item.grams,
    filamentType: item.filamentType,
  }).filter((line) => line.grams > 0);

  return {
    ...base,
    type: ProductType.FDM,
    grams: filaments.length
      ? totalFdmFilamentGrams(filaments)
      : Number(item.grams) || 0,
    printTimeHours: Number(item.printTimeHours) || 0,
    workTimeHours: Number(item.workTimeHours) || 0,
    filamentType:
      filaments.find((line) => line.filamentType)?.filamentType ??
      item.filamentType,
    filaments: filaments.length ? filaments : undefined,
  };
}

function persistedLinePrice(value: number): number {
  const price = Number(value);
  if (!Number.isFinite(price) || price < 0) return 0;
  return price;
}
