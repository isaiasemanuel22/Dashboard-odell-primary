import type {
  CreateProductPayload,
  FdmFilamentLine,
  Product,
  ProductAttachment,
  ProductComponent,
} from '../../core/models';
import { ProductType } from '../../core/models';

/** «X» → «X (copia)»; «X (copia)» → «X (copia 2)»; «X (copia 2)» → «X (copia 3)». */
export function duplicateName(name: string): string {
  const match = /^(.*) \(copia(?: (\d+))?\)$/.exec(name);
  if (!match) return `${name} (copia)`;
  return `${match[1]} (copia ${(match[2] ? Number(match[2]) : 1) + 1})`;
}

/** Como `duplicateName`, pero sigue sumando hasta un nombre que no exista (el backend exige nombres únicos). */
export function uniqueDuplicateName(
  name: string,
  existingNames: readonly string[] = [],
): string {
  const taken = new Set(existingNames.map((n) => n.trim().toLowerCase()));
  let candidate = duplicateName(name);
  while (taken.has(candidate.trim().toLowerCase())) {
    candidate = duplicateName(candidate);
  }
  return candidate;
}

/**
 * Payload de creación de una copia del producto, sin pasar por el formulario.
 * Manda solo campos que el DTO del backend acepta (forbidNonWhitelisted);
 * el backend recalcula costo y precio igual que para el original.
 * Nombre «(copia)», stock 0 y sin publicar. No muta el original.
 */
export function buildProductDuplicatePayload(
  source: Product,
  existingNames: readonly string[] = [],
): CreateProductPayload {
  const src = structuredClone(source) as Product & Record<string, any>;

  const components: ProductComponent[] = (src.components ?? []).map((c) => ({
    productId: c.productId,
    quantity: c.quantity,
    ...(c.colorId ? { colorId: c.colorId } : {}),
  }));
  const attachments: ProductAttachment[] = (src.attachments ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    url: a.url,
    mimeType: a.mimeType,
    size: a.size,
  }));

  const base: Record<string, unknown> = {
    name: uniqueDuplicateName(source.name, existingNames),
    description: src.description,
    type: src.type,
    size: src.size,
    price: src.price,
    cost: src.cost,
    suggestedPrice: src.suggestedPrice ?? null,
    discountPercent: src.discountPercent ?? null,
    discountAmount: src.discountAmount ?? null,
    categoryIds: src.categoryIds ?? [],
    images: src.images ?? [],
    attachments,
    published: false,
    stock: 0,
    includesPieces: src.includesPieces,
    components,
    assemblyTimeHours: src.assemblyTimeHours ?? 0,
  };

  if (src.type === ProductType.COMBO) {
    return {
      ...base,
      supplies: src.supplies ?? [],
    } as unknown as CreateProductPayload;
  }

  if (src.type === ProductType.ESTAMPADO) {
    return {
      ...base,
      workTimeHours: src.workTimeHours ?? 0,
      prints: src.prints ?? [],
      pressCycles: src.pressCycles ?? [],
      supplies: src.supplies ?? [],
    } as unknown as CreateProductPayload;
  }

  const filaments = src.filaments?.map((line: FdmFilamentLine) => {
    const { source: _source, ...rest } = line;
    return rest;
  });
  return {
    ...base,
    grams: src.grams ?? 0,
    printTimeHours: src.printTimeHours ?? 0,
    workTimeHours: src.workTimeHours ?? 0,
    brand: src.brand,
    filamentType: src.filamentType,
    filaments,
    purgeGrams: src.purgeGrams,
    colorChanges: src.colorChanges,
    preferredPrinterId: src.preferredPrinterId,
    resinType: src.resinType,
    colorId: src.colorId,
    washMinutes: src.washMinutes,
    cureMinutes: src.cureMinutes,
    supplies: src.supplies ?? [],
  } as unknown as CreateProductPayload;
}
