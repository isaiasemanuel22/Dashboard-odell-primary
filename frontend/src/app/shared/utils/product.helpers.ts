import {
  Category,
  EstampadoSupplyLine,
  FilamentType,
  INDISTINTO_COLOR_ID,
  Product,
  ProductComponent,
  ProductType,
  ServiceProfitMargins,
  ServiceType,
} from '../../core/models';
import { isDesignService } from './service-type.util';
import {
  packagingPriceFromValue,
  supplyLinesCost,
  supplyLinesPrice,
  supplyLinesValue,
} from './supply-line-value.util';

export function normalizeProductComponents(
  raw: ProductComponent[] | unknown,
  catalog?: Pick<Product, 'id' | 'name'>[],
): ProductComponent[] {
  if (raw == null) return [];

  if (Array.isArray(raw)) {
    return raw
      .map((item) => normalizeOneProductComponent(item, catalog))
      .filter((item): item is ProductComponent => item !== null);
  }

  if (typeof raw === 'object') {
    return Object.entries(raw as Record<string, unknown>)
      .map(([key, value]) =>
        normalizeOneProductComponent(
          typeof value === 'object' && value !== null
            ? value
            : { productId: key, quantity: value },
          catalog,
        ),
      )
      .filter((item): item is ProductComponent => item !== null);
  }

  return [];
}

function normalizeOneProductComponent(
  item: unknown,
  catalog?: Pick<Product, 'id' | 'name'>[],
): ProductComponent | null {
  if (typeof item === 'string') {
    const productId = item.trim();
    return productId
      ? { productId, quantity: 1, colorId: INDISTINTO_COLOR_ID }
      : null;
  }

  if (!item || typeof item !== 'object') return null;

  const record = item as Record<string, unknown>;
  const productId = resolveComponentProductId(record, catalog);
  if (!productId) return null;

  const quantityRaw =
    record['quantity'] ??
    record['qty'] ??
    record['count'] ??
    record['amount'] ??
    1;
  const quantity = Math.max(1, Math.floor(Number(quantityRaw) || 1));
  const colorIdRaw = pickComponentString(record, ['colorId', 'color_id']);
  const colorId =
    colorIdRaw && colorIdRaw !== INDISTINTO_COLOR_ID
      ? colorIdRaw
      : INDISTINTO_COLOR_ID;

  return { productId, quantity, colorId };
}

function resolveComponentProductId(
  record: Record<string, unknown>,
  catalog?: Pick<Product, 'id' | 'name'>[],
): string | null {
  const direct = pickComponentString(record, [
    'productId',
    'product_id',
    'productID',
    'pieceId',
    'piece_id',
    'product',
    'ref',
  ]);
  if (direct) return direct;

  const nestedProduct = record['product'];
  if (nestedProduct && typeof nestedProduct === 'object') {
    const nestedRecord = nestedProduct as Record<string, unknown>;
    const nestedId = pickComponentString(nestedRecord, [
      'productId',
      'product_id',
      'id',
    ]);
    if (nestedId) return nestedId;

    const byNestedName = resolveComponentProductIdByName(
      pickComponentString(nestedRecord, ['name']),
      catalog,
    );
    if (byNestedName) return byNestedName;
  }

  const byName = resolveComponentProductIdByName(
    pickComponentString(record, ['name', 'productName', 'pieceName', 'piece']),
    catalog,
  );
  if (byName) return byName;

  const fallbackId = pickComponentString(record, ['id']);
  if (!fallbackId) return null;
  if (catalog?.some((entry) => entry.id === fallbackId)) return fallbackId;
  if (/^prod-/i.test(fallbackId)) return fallbackId;

  return null;
}

function resolveComponentProductIdByName(
  name: string | null,
  catalog?: Pick<Product, 'id' | 'name'>[],
): string | null {
  if (!name || !catalog?.length) return null;
  const normalized = name.trim().toLowerCase();
  return (
    catalog.find((entry) => entry.name.trim().toLowerCase() === normalized)
      ?.id ?? null
  );
}

function pickComponentString(
  record: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

export function findProductById(
  catalog: Product[],
  id: string,
): Product | undefined {
  return catalog.find((p) => p.id === id);
}

export function productUsesPieceAssembly(
  product: Pick<Product, 'type' | 'includesPieces' | 'components'> | undefined,
): boolean {
  if (!product) return false;
  const components = normalizeProductComponents(product.components ?? []);
  return (
    product.type === ProductType.COMBO ||
    product.includesPieces === true ||
    components.length > 0
  );
}

/**
 * Con `options` el costo del combo incluye el armado (horas × tarifa) y sus
 * insumos propios, igual que el backend (CostCalculatorService). Sin
 * `options` es solo la suma de piezas.
 */
export interface ProductUnitCostOptions {
  laborCostPerHour?: number;
  supplyUnitPrice?: (supplyId: string) => number;
  /** Margen de error de Ajustes para insumos propios del combo (§16.3). */
  errorMarginPercent?: number;
}

/**
 * Valor del packaging de las piezas de un combo × cantidad (§27.4). Cada
 * pieza aporta solo su packaging propio: una pieza combo no suma el de sus
 * piezas (sin ciclos).
 */
export function componentsPackagingValue(
  catalog: Product[],
  components: ProductComponent[],
  unitPriceOf: (supplyId: string) => number,
): number {
  return components.reduce((sum, item) => {
    const part = findProductById(catalog, item.productId);
    if (!part) return sum;
    const qty = Math.max(1, Number(item.quantity) || 1);
    return (
      sum + supplyLinesValue(part.packagingSupplies, unitPriceOf) * qty
    );
  }, 0);
}

/**
 * Valor del packaging propio de un producto más, en un combo con
 * `sumPiecesPackaging`, el de sus piezas (§27.2, §27.4). Costo = valor;
 * precio = `packagingPriceFromValue(valor)`.
 */
export function productPackagingValue(
  product: {
    type?: ProductType;
    packagingSupplies?: EstampadoSupplyLine[];
    sumPiecesPackaging?: boolean;
    components?: ProductComponent[];
  },
  catalog: Product[],
  unitPriceOf: (supplyId: string) => number,
): number {
  const own = supplyLinesValue(product.packagingSupplies, unitPriceOf);
  if (product.type !== ProductType.COMBO || !product.sumPiecesPackaging) {
    return own;
  }
  const components = normalizeProductComponents(
    product.components ?? [],
    catalog,
  );
  return own + componentsPackagingValue(catalog, components, unitPriceOf);
}

/**
 * Costo de una pieza de combo sin su packaging (§27.4): el costo guardado de
 * la pieza lo incluye. Sin precios de insumo (`unitPriceOf`) no se puede
 * separar y queda el costo tal cual.
 */
export function pieceCostWithoutPackaging(
  part: Product | undefined,
  cost: number,
  catalog: Product[],
  unitPriceOf?: (supplyId: string) => number,
): number {
  if (!part || !unitPriceOf) return cost;
  return Math.max(
    0,
    cost - Math.round(productPackagingValue(part, catalog, unitPriceOf)),
  );
}

/** Precio de una pieza de combo sin su packaging (valor × 1,25). */
export function piecePriceWithoutPackaging(
  part: Product | undefined,
  price: number,
  catalog: Product[],
  unitPriceOf?: (supplyId: string) => number,
): number {
  if (!part || !unitPriceOf) return price;
  return Math.max(
    0,
    price -
      packagingPriceFromValue(productPackagingValue(part, catalog, unitPriceOf)),
  );
}

export function resolveProductUnitCost(
  product:
    | Pick<Product, 'id' | 'type' | 'includesPieces' | 'components' | 'cost'>
    | undefined,
  catalog: Product[],
  visiting: Set<string> = new Set(),
  options?: ProductUnitCostOptions,
): number {
  if (!product) return 0;
  if (visiting.has(product.id)) return product.cost ?? 0;

  const components = normalizeProductComponents(
    product.components ?? [],
    catalog,
  );
  if (
    !productUsesPieceAssembly({ ...product, components }) ||
    components.length === 0
  ) {
    return product.cost ?? 0;
  }

  visiting.add(product.id);
  const partsCost = components.reduce((sum, item) => {
    const part = findProductById(catalog, item.productId);
    const qty = Math.max(1, Number(item.quantity) || 1);
    return (
      sum +
      pieceCostWithoutPackaging(
        part,
        resolveProductUnitCost(part, catalog, visiting, options),
        catalog,
        options?.supplyUnitPrice,
      ) *
        qty
    );
  }, 0);
  visiting.delete(product.id);

  if (!options) return partsCost;
  const assemblyHours = Number((product as Product).assemblyTimeHours) || 0;
  const assembly = Math.round(
    Math.max(0, assemblyHours) * (Number(options.laborCostPerHour) || 0),
  );
  const supplies = options.supplyUnitPrice
    ? supplyLinesCost(
        // Insumos propios del combo: `supplies` (fallback legado `estampadoSupplies`).
        (product as { supplies?: EstampadoSupplyLine[] }).supplies ??
          (product as { estampadoSupplies?: EstampadoSupplyLine[] })
            .estampadoSupplies,
        options.supplyUnitPrice,
        options.errorMarginPercent,
      )
    : 0;
  const packaging = options.supplyUnitPrice
    ? productPackagingValue(
        product as Product,
        catalog,
        options.supplyUnitPrice,
      )
    : 0;
  return partsCost + assembly + supplies + packaging;
}

export function resolveProductUnitPrice(
  product:
    | Pick<Product, 'id' | 'type' | 'includesPieces' | 'components' | 'price'>
    | undefined,
  catalog: Product[],
  visiting: Set<string> = new Set(),
  options?: ProductUnitCostOptions,
): number {
  if (!product) return 0;
  if (visiting.has(product.id)) return product.price ?? 0;
  // Combo usado como pieza de otro: cuenta su precio propio, no la suma de sus piezas.
  if (
    visiting.size > 0 &&
    product.type === ProductType.COMBO &&
    (product.price ?? 0) > 0
  ) {
    return product.price;
  }

  const components = normalizeProductComponents(
    product.components ?? [],
    catalog,
  );
  if (
    !productUsesPieceAssembly({ ...product, components }) ||
    components.length === 0
  ) {
    return product.price ?? 0;
  }

  visiting.add(product.id);
  const partsPrice = components.reduce((sum, item) => {
    const part = findProductById(catalog, item.productId);
    const qty = Math.max(1, Number(item.quantity) || 1);
    return (
      sum +
      piecePriceWithoutPackaging(
        part,
        resolveProductUnitPrice(part, catalog, visiting, options),
        catalog,
        options?.supplyUnitPrice,
      ) *
        qty
    );
  }, 0);
  visiting.delete(product.id);

  if (!options) return partsPrice;
  // Igual que el backend (§16.1.3): armado sin margen + insumos propios × 2.
  const assembly = Math.round(
    Math.max(0, Number((product as Product).assemblyTimeHours) || 0) *
      (Number(options.laborCostPerHour) || 0),
  );
  const ownSupplies = options.supplyUnitPrice
    ? supplyLinesPrice(
        (product as { supplies?: EstampadoSupplyLine[] }).supplies ??
          (product as { estampadoSupplies?: EstampadoSupplyLine[] })
            .estampadoSupplies,
        options.supplyUnitPrice,
        options.errorMarginPercent,
      )
    : 0;
  const packaging = options.supplyUnitPrice
    ? packagingPriceFromValue(
        productPackagingValue(
          product as Product,
          catalog,
          options.supplyUnitPrice,
        ),
      )
    : 0;
  return partsPrice + assembly + ownSupplies + packaging;
}

export function getProductName(
  catalog: Product[],
  id: string,
  fallback = 'Producto',
): string {
  return findProductById(catalog, id)?.name ?? fallback;
}

export function getComponentLineCost(
  catalog: Product[],
  productId: string,
  quantity: number,
  /** Con precios de insumo, la pieza se toma sin su packaging (§27.4). */
  unitPriceOf?: (supplyId: string) => number,
): number {
  const part = findProductById(catalog, productId);
  const qty = Math.max(1, Number(quantity) || 1);
  return (
    pieceCostWithoutPackaging(
      part,
      resolveProductUnitCost(part, catalog),
      catalog,
      unitPriceOf,
    ) * qty
  );
}

export function getComponentLinePrice(
  catalog: Product[],
  productId: string,
  quantity: number,
  unitPriceOf?: (supplyId: string) => number,
): number {
  const part = findProductById(catalog, productId);
  const qty = Math.max(1, Number(quantity) || 1);
  // Pieza que es combo: su precio propio, no la suma de sus piezas.
  const unit =
    part?.type === ProductType.COMBO && (part.price ?? 0) > 0
      ? part.price
      : resolveProductUnitPrice(part, catalog);
  return piecePriceWithoutPackaging(part, unit, catalog, unitPriceOf) * qty;
}

export function sumComponentsCost(
  catalog: Product[],
  components: ProductComponent[],
  unitPriceOf?: (supplyId: string) => number,
): number {
  return components.reduce(
    (sum, item) =>
      sum +
      getComponentLineCost(catalog, item.productId, item.quantity, unitPriceOf),
    0,
  );
}

export function calculateCatalogLinesCost(
  lines: Array<{ productId?: string; quantity: number }>,
  catalog: Product[],
): number {
  return lines.reduce((sum, line) => {
    if (!line.productId) return sum;
    return sum + getComponentLineCost(catalog, line.productId, line.quantity);
  }, 0);
}

export function calculateOrderLinesCost(
  lines: Array<{
    serviceType?: ServiceType;
    productId?: string;
    quantity: number;
    unitCost?: number;
    unitPrice?: number;
    designUnitPrice?: number;
    includesPrint?: boolean;
    printUnitCost?: number;
    printTimeHours?: number;
    grams?: number;
    filamentType?: FilamentType;
  }>,
  catalog: Product[],
  _profitMargins: ServiceProfitMargins,
): number {
  return lines.reduce((sum, line) => {
    const qty = Math.max(0, Number(line.quantity) || 0);

    // Servicio de un tercero: costo cargado × cantidad, como cualquier línea (§16.3).

    // Diseño: costo = horas × tarifa del form (unitCost). No inventar desde precio.
    if (line.serviceType && isDesignService(line.serviceType)) {
      const designCost =
        line.unitCost != null && line.unitCost >= 0 ? line.unitCost : 0;
      const printCost = line.includesPrint ? (line.printUnitCost ?? 0) : 0;
      return sum + designCost + printCost * qty;
    }

    // FDM / Estampado / etc.: usar el costo unitario del formulario (no el del catálogo).
    if (line.unitCost != null && line.unitCost >= 0) {
      return sum + line.unitCost * qty;
    }

    if (line.productId) {
      return sum + getComponentLineCost(catalog, line.productId, line.quantity);
    }

    return sum;
  }, 0);
}

/** Suma de precios de LISTA de las piezas × cantidad (sin descuentos de pieza). */
export function sumComponentsPrice(
  catalog: Product[],
  components: ProductComponent[],
  unitPriceOf?: (supplyId: string) => number,
): number {
  return components.reduce(
    (sum, item) =>
      sum +
      getComponentLinePrice(catalog, item.productId, item.quantity, unitPriceOf),
    0,
  );
}

function isProduct3DType(type: ProductType | undefined): boolean {
  return type === ProductType.FDM || type === ProductType.RESINA;
}

/** Redondea horas de producción a un decimal. */
export function roundProductionHours(value: number): number {
  return Math.round(Math.max(0, Number(value) || 0) * 10) / 10;
}

export function resolveProductGrams(
  product:
    | (Pick<Product, 'id' | 'type' | 'includesPieces' | 'components'> & {
        grams?: number;
      })
    | undefined,
  catalog: Product[],
  visiting: Set<string> = new Set(),
): number {
  if (!product?.id || visiting.has(product.id)) {
    return 0;
  }

  const components = normalizeProductComponents(
    product.components ?? [],
    catalog,
  );
  if (!productUsesPieceAssembly(product) || components.length === 0) {
    return Math.max(0, Number(product.grams) || 0);
  }

  if (!isProduct3DType(product.type)) {
    return 0;
  }

  visiting.add(product.id);
  const total = components.reduce((sum, item) => {
    const part = findProductById(catalog, item.productId);
    const qty = Math.max(1, Number(item.quantity) || 1);
    return sum + resolveProductGrams(part, catalog, visiting) * qty;
  }, 0);
  visiting.delete(product.id);

  return total;
}

export function resolveProductPrintTimeHours(
  product:
    | (Pick<Product, 'id' | 'type' | 'includesPieces' | 'components'> & {
        printTimeHours?: number;
      })
    | undefined,
  catalog: Product[],
  visiting: Set<string> = new Set(),
): number {
  if (!product?.id || visiting.has(product.id)) {
    return 0;
  }

  const components = normalizeProductComponents(
    product.components ?? [],
    catalog,
  );
  if (!productUsesPieceAssembly(product) || components.length === 0) {
    return roundProductionHours(Number(product.printTimeHours) || 0);
  }

  if (!isProduct3DType(product.type)) {
    return 0;
  }

  visiting.add(product.id);
  const total = components.reduce((sum, item) => {
    const part = findProductById(catalog, item.productId);
    const qty = Math.max(1, Number(item.quantity) || 1);
    return sum + resolveProductPrintTimeHoursRaw(part, catalog, visiting) * qty;
  }, 0);
  visiting.delete(product.id);

  return roundProductionHours(total);
}

function resolveProductPrintTimeHoursRaw(
  product:
    | (Pick<Product, 'id' | 'type' | 'includesPieces' | 'components'> & {
        printTimeHours?: number;
      })
    | undefined,
  catalog: Product[],
  visiting: Set<string> = new Set(),
): number {
  if (!product?.id || visiting.has(product.id)) {
    return 0;
  }

  const components = normalizeProductComponents(
    product.components ?? [],
    catalog,
  );
  if (!productUsesPieceAssembly(product) || components.length === 0) {
    return Math.max(0, Number(product.printTimeHours) || 0);
  }

  if (!isProduct3DType(product.type)) {
    return 0;
  }

  visiting.add(product.id);
  const total = components.reduce((sum, item) => {
    const part = findProductById(catalog, item.productId);
    const qty = Math.max(1, Number(item.quantity) || 1);
    return sum + resolveProductPrintTimeHoursRaw(part, catalog, visiting) * qty;
  }, 0);
  visiting.delete(product.id);

  return total;
}

export function resolveProductWorkTimeHours(
  product:
    | (Pick<
        Product,
        'id' | 'type' | 'includesPieces' | 'components' | 'assemblyTimeHours'
      > & {
        workTimeHours?: number;
      })
    | undefined,
  catalog: Product[],
  visiting: Set<string> = new Set(),
): number {
  return roundProductionHours(
    resolveProductWorkTimeHoursRaw(product, catalog, visiting),
  );
}

function resolveProductWorkTimeHoursRaw(
  product:
    | (Pick<
        Product,
        'id' | 'type' | 'includesPieces' | 'components' | 'assemblyTimeHours'
      > & {
        workTimeHours?: number;
      })
    | undefined,
  catalog: Product[],
  visiting: Set<string> = new Set(),
): number {
  if (!product?.id || visiting.has(product.id)) {
    return 0;
  }

  const components = normalizeProductComponents(
    product.components ?? [],
    catalog,
  );
  if (!productUsesPieceAssembly(product) || components.length === 0) {
    return Math.max(0, Number(product.workTimeHours) || 0);
  }

  if (!isProduct3DType(product.type)) {
    return 0;
  }

  visiting.add(product.id);
  const partsWork = components.reduce((sum, item) => {
    const part = findProductById(catalog, item.productId);
    const qty = Math.max(1, Number(item.quantity) || 1);
    return sum + resolveProductWorkTimeHoursRaw(part, catalog, visiting) * qty;
  }, 0);
  visiting.delete(product.id);

  return (Number(product.assemblyTimeHours) || 0) + partsWork;
}

export function sumComponentsProductionMetrics(
  catalog: Product[],
  components: ProductComponent[],
  options?: { assemblyTimeHours?: number },
  visiting: Set<string> = new Set(),
): { grams: number; printTimeHours: number; workTimeHours: number } {
  let grams = 0;
  let printTimeHours = 0;
  let partsWork = 0;

  for (const component of components) {
    const part = findProductById(catalog, component.productId);
    const qty = Math.max(1, Number(component.quantity) || 1);
    grams += resolveProductGrams(part, catalog, visiting) * qty;
    printTimeHours +=
      resolveProductPrintTimeHoursRaw(part, catalog, visiting) * qty;
    partsWork += resolveProductWorkTimeHoursRaw(part, catalog, visiting) * qty;
  }

  return {
    grams,
    printTimeHours: roundProductionHours(printTimeHours),
    workTimeHours: roundProductionHours(
      (Number(options?.assemblyTimeHours) || 0) + partsWork,
    ),
  };
}

export function resolveCategoryNames(
  categoryIds: string[],
  categories: Category[],
): string[] {
  return categoryIds
    .map((id) => categories.find((c) => c.id === id)?.name)
    .filter((name): name is string => Boolean(name));
}

export function resolveCategoryNamesText(
  categoryIds: string[],
  categories: Category[],
): string {
  return resolveCategoryNames(categoryIds, categories).join(', ');
}

export function productComponentSelectLabel(product: Product): string {
  return product.published === false
    ? `${product.name} (interno)`
    : product.name;
}

export function isProductPublished(product: Product): boolean {
  return product.published !== false;
}
