import { BadRequestException } from '@nestjs/common';
import { ProductType } from '../common/enums';
import { resolveProductColorId } from '../common/color.util';
import {
  ColorConfig,
  CreateProductDto,
  Product,
  ProductComponent,
  UpdateProductDto,
} from '../common/interfaces';
import {
  hasValidFdmFilamentInput,
  resolveFdmFilaments,
} from './fdm-product.util';

export const PRINTED_PRODUCT_MATERIAL_REQUIRED =
  'Indicá los gramos y el tipo de material. El costo de un producto de impresión 3D sale de eso. No se puede guardar solo con el precio.';

export function assertPrintedProductMaterial(
  data: CreateProductDto,
  isUpdate: boolean,
  incoming?: UpdateProductDto,
): void {
  if (!requiresPrintedMaterial(data, isUpdate, incoming)) return;

  if (data.type === ProductType.FDM) {
    const filaments = resolveFdmFilaments({
      filaments: data.filaments,
      grams: data.grams,
      filamentType: data.filamentType,
      brand: data.brand,
    });
    if (!hasValidFdmFilamentInput(filaments)) {
      throw new BadRequestException(PRINTED_PRODUCT_MATERIAL_REQUIRED);
    }
    return;
  }

  if (!data.resinType?.trim()) {
    throw new BadRequestException(PRINTED_PRODUCT_MATERIAL_REQUIRED);
  }
}

export function rejectPrintedProductWithoutCost(
  data: CreateProductDto,
  cost: number,
  isUpdate = false,
  incoming?: UpdateProductDto,
): void {
  if (!requiresPrintedMaterial(data, isUpdate, incoming)) return;
  if (Number(cost) > 0) return;
  throw new BadRequestException(PRINTED_PRODUCT_MATERIAL_REQUIRED);
}

export function requiresPrintedMaterial(
  data: CreateProductDto,
  isUpdate: boolean,
  incoming?: UpdateProductDto,
): boolean {
  if (data.type !== ProductType.FDM && data.type !== ProductType.RESINA) {
    return false;
  }
  const components = data.components ?? [];
  if (data.includesPieces === true || components.length > 0) {
    return false;
  }
  const request = incoming ?? data;
  return (
    !isUpdate ||
    request.price !== undefined ||
    request.cost !== undefined ||
    request.grams !== undefined ||
    request.filaments !== undefined ||
    request.filamentType !== undefined ||
    request.resinType !== undefined ||
    request.type !== undefined
  );
}

export function validateProductComponents(
  productId: string | null,
  components: ProductComponent[],
  products: Product[],
  colors: ColorConfig[],
): void {
  const seen = new Set<string>();

  for (const component of components) {
    if (!component.productId) {
      throw new BadRequestException('Cada pieza debe referenciar un producto');
    }
    if (Number(component.quantity) < 1) {
      throw new BadRequestException(
        'La cantidad de cada pieza debe ser al menos 1',
      );
    }
    if (productId && component.productId === productId) {
      throw new BadRequestException(
        'Un producto no puede incluirse a sí mismo como pieza',
      );
    }
    if (seen.has(component.productId)) {
      throw new BadRequestException(
        'Cada pieza solo puede aparecer una vez en la lista',
      );
    }
    seen.add(component.productId);

    const part = products.find((p) => p.id === component.productId);
    if (!part) {
      throw new BadRequestException(
        `Producto pieza ${component.productId} no encontrado`,
      );
    }

    assertNoProductComponentCycle(
      component.productId,
      productId,
      new Set<string>(),
      products,
    );

    resolveProductColorId(
      colors,
      component.colorId,
    );
  }
}

function assertNoProductComponentCycle(
  currentId: string,
  rootId: string | null,
  visited: Set<string>,
  products: Product[],
): void {
  if (rootId && currentId === rootId) {
    throw new BadRequestException(
      'Referencia circular entre productos compuestos',
    );
  }
  if (visited.has(currentId)) {
    return;
  }
  visited.add(currentId);

  const product = products.find((p) => p.id === currentId);
  if (!product?.components?.length) {
    return;
  }

  for (const child of product.components) {
    assertNoProductComponentCycle(child.productId, rootId, visited, products);
  }
}
