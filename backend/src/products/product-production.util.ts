import { ProductType } from '../common/enums';
import { Product, Product3D, ProductComponent } from '../common/interfaces';
import { StoreService } from '../store/store.service';
import {
  normalizeProductComponents,
  productUsesPieceAssembly,
} from './product-component.util';

function isProduct3D(product: Product): product is Product3D {
  return (
    product.type === ProductType.FDM || product.type === ProductType.RESINA
  );
}

/** Redondea horas de producción a un decimal. */
export function roundProductionHours(value: number): number {
  return Math.round(Math.max(0, Number(value) || 0) * 10) / 10;
}

export function resolveProductGrams(
  store: StoreService,
  productId: string,
  visiting: Set<string> = new Set(),
): number {
  if (visiting.has(productId)) {
    return 0;
  }

  const product = store.getProductById(productId);
  if (!product || !isProduct3D(product)) {
    return 0;
  }

  const catalog = store.products.map((entry) => ({
    id: entry.id,
    name: entry.name,
  }));
  const components = normalizeProductComponents(product.components ?? [], catalog);

  if (!productUsesPieceAssembly(product) || components.length === 0) {
    return Math.max(0, Number(product.grams) || 0);
  }

  visiting.add(productId);
  const total = components.reduce((sum, component) => {
    const qty = Math.max(1, Math.trunc(Number(component.quantity) || 1));
    return sum + resolveProductGrams(store, component.productId, visiting) * qty;
  }, 0);
  visiting.delete(productId);

  return total;
}

function resolveProductPrintTimeHoursRaw(
  store: StoreService,
  productId: string,
  visiting: Set<string> = new Set(),
): number {
  if (visiting.has(productId)) {
    return 0;
  }

  const product = store.getProductById(productId);
  if (!product || !isProduct3D(product)) {
    return 0;
  }

  const catalog = store.products.map((entry) => ({
    id: entry.id,
    name: entry.name,
  }));
  const components = normalizeProductComponents(product.components ?? [], catalog);

  if (!productUsesPieceAssembly(product) || components.length === 0) {
    return Math.max(0, Number(product.printTimeHours) || 0);
  }

  visiting.add(productId);
  const total = components.reduce((sum, component) => {
    const qty = Math.max(1, Math.trunc(Number(component.quantity) || 1));
    return (
      sum +
      resolveProductPrintTimeHoursRaw(store, component.productId, visiting) *
        qty
    );
  }, 0);
  visiting.delete(productId);

  return total;
}

export function resolveProductPrintTimeHours(
  store: StoreService,
  productId: string,
  visiting: Set<string> = new Set(),
): number {
  return roundProductionHours(
    resolveProductPrintTimeHoursRaw(store, productId, visiting),
  );
}

function resolveProductWorkTimeHoursRaw(
  store: StoreService,
  productId: string,
  visiting: Set<string> = new Set(),
): number {
  if (visiting.has(productId)) {
    return 0;
  }

  const product = store.getProductById(productId);
  if (!product || !isProduct3D(product)) {
    return 0;
  }

  const catalog = store.products.map((entry) => ({
    id: entry.id,
    name: entry.name,
  }));
  const components = normalizeProductComponents(product.components ?? [], catalog);

  if (!productUsesPieceAssembly(product) || components.length === 0) {
    return Math.max(0, Number(product.workTimeHours) || 0);
  }

  visiting.add(productId);
  const partsWork = components.reduce((sum, component) => {
    const qty = Math.max(1, Math.trunc(Number(component.quantity) || 1));
    return (
      sum +
      resolveProductWorkTimeHoursRaw(store, component.productId, visiting) * qty
    );
  }, 0);
  visiting.delete(productId);

  return (Number(product.assemblyTimeHours) || 0) + partsWork;
}

export function resolveProductWorkTimeHours(
  store: StoreService,
  productId: string,
  visiting: Set<string> = new Set(),
): number {
  return roundProductionHours(
    resolveProductWorkTimeHoursRaw(store, productId, visiting),
  );
}

export function sumComponentsProductionMetrics(
  store: StoreService,
  components: ProductComponent[],
  options?: { assemblyTimeHours?: number },
  visiting: Set<string> = new Set(),
): { grams: number; printTimeHours: number; workTimeHours: number } {
  let grams = 0;
  let printTimeHours = 0;
  let partsWork = 0;

  for (const component of components) {
    const qty = Math.max(1, Math.trunc(Number(component.quantity) || 1));
    grams += resolveProductGrams(store, component.productId, visiting) * qty;
    printTimeHours +=
      resolveProductPrintTimeHoursRaw(store, component.productId, visiting) *
      qty;
    partsWork +=
      resolveProductWorkTimeHoursRaw(store, component.productId, visiting) * qty;
  }

  return {
    grams,
    printTimeHours: roundProductionHours(printTimeHours),
    workTimeHours: roundProductionHours(
      (Number(options?.assemblyTimeHours) || 0) + partsWork,
    ),
  };
}

export function withResolvedProductionMetrics(
  store: StoreService,
  product: Product,
): Product {
  if (!isProduct3D(product)) {
    return product;
  }

  const catalog = store.products.map((entry) => ({
    id: entry.id,
    name: entry.name,
  }));
  const components = normalizeProductComponents(product.components ?? [], catalog);

  if (!productUsesPieceAssembly(product) || components.length === 0) {
    return {
      ...product,
      printTimeHours: roundProductionHours(Number(product.printTimeHours) || 0),
      workTimeHours: roundProductionHours(Number(product.workTimeHours) || 0),
    };
  }

  return {
    ...product,
    grams: resolveProductGrams(store, product.id),
    printTimeHours: resolveProductPrintTimeHours(store, product.id),
    workTimeHours: resolveProductWorkTimeHours(store, product.id),
  };
}
