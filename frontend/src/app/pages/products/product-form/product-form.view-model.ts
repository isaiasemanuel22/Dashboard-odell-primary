import {
  Category,
  Product,
  ProductComponent,
  ProductType,
  isProductType3D,
} from '../../../core/models';
import { ProductFormGroup } from '../../../core/services/product-form-state-manager.service';
import {
  productComponentSelectLabel,
  sumComponentsCost,
  sumComponentsPrice,
} from '../../../shared/utils/product.helpers';
import { isEstampadoPrintValid } from '../../../shared/utils/estampado.helpers';
import { DbSelectOption } from '@general-components';

export interface ProductFormViewContext {
  form: ProductFormGroup;
  categoriesList?: Category[];
  catalogProducts: Product[];
  editingProductId?: string;
}

export function formType(form: ProductFormGroup): ProductType {
  return form.controls.type.value;
}

export function formIncludesPieces(form: ProductFormGroup): boolean {
  return form.controls.includesPieces.value;
}

export function isFormCombo(form: ProductFormGroup): boolean {
  return formType(form) === ProductType.COMBO;
}

export function isFormEstampado(form: ProductFormGroup): boolean {
  return formType(form) === ProductType.ESTAMPADO;
}

export function isFormFdm(form: ProductFormGroup): boolean {
  return formType(form) === ProductType.FDM;
}

export function isFormResina(form: ProductFormGroup): boolean {
  return formType(form) === ProductType.RESINA;
}

export function isForm3D(form: ProductFormGroup): boolean {
  return isProductType3D(formType(form));
}

export function usesFormPieceAssembly(form: ProductFormGroup): boolean {
  return isFormCombo(form) || formIncludesPieces(form);
}

export function showFormIncludesPiecesCheckbox(form: ProductFormGroup): boolean {
  return !isFormCombo(form);
}

export function showFormProductionFields(form: ProductFormGroup): boolean {
  return !isFormCombo(form) && !formIncludesPieces(form);
}

export function showFormGenericSizeField(form: ProductFormGroup): boolean {
  return !isFormCombo(form) && (!isFormEstampado(form) || usesFormPieceAssembly(form));
}

export function showFormComponentsSection(form: ProductFormGroup): boolean {
  return isFormCombo(form) || formIncludesPieces(form);
}

export function formComponents(form: ProductFormGroup): ProductComponent[] {
  return form.controls.components.value;
}

export function formCategoryIds(form: ProductFormGroup): string[] {
  return form.controls.categoryIds.value;
}

export function componentsCostTotal(
  catalogProducts: Product[],
  form: ProductFormGroup,
): number {
  return sumComponentsCost(catalogProducts, formComponents(form));
}

export function componentsPriceTotal(
  catalogProducts: Product[],
  form: ProductFormGroup,
): number {
  return sumComponentsPrice(catalogProducts, formComponents(form));
}

export function filteredCategories(ctx: ProductFormViewContext): Category[] {
  return (ctx.categoriesList ?? []).filter((c) =>
    c.productTypes.includes(formType(ctx.form)),
  );
}

export function unselectedCategoryOptions(
  ctx: ProductFormViewContext,
): DbSelectOption[] {
  const ids = formCategoryIds(ctx.form);
  return filteredCategories(ctx)
    .filter((c) => !ids.includes(c.id))
    .map((c) => ({ value: c.id, label: c.name }));
}

export function selectedCategories(ctx: ProductFormViewContext): Category[] {
  return formCategoryIds(ctx.form)
    .map((id) => (ctx.categoriesList ?? []).find((c) => c.id === id))
    .filter((c): c is Category => Boolean(c));
}

export function canAddCategory(ctx: ProductFormViewContext): boolean {
  return (
    formCategoryIds(ctx.form).length < 5 &&
    unselectedCategoryOptions(ctx).length > 0
  );
}

export function availableComponentOptions(
  ctx: ProductFormViewContext,
): DbSelectOption[] {
  const used = new Set(formComponents(ctx.form).map((c) => c.productId));
  return ctx.catalogProducts
    .filter((p) => p.id !== ctx.editingProductId && !used.has(p.id))
    .map((p) => ({
      value: p.id,
      label: productComponentSelectLabel(p),
    }));
}

export function canAddComponent(ctx: ProductFormViewContext): boolean {
  return (
    availableComponentOptions(ctx).length > 0 &&
    ctx.form.controls.componentQty.value >= 1
  );
}

export function hasEstampadoPricingInput(form: ProductFormGroup): boolean {
  if (!isFormEstampado(form) || usesFormPieceAssembly(form)) {
    return false;
  }

  const prints = form.controls.prints.value;
  const supplyLines = form.controls.supplyLines.value;
  const pressCycles = form.controls.pressCycles.value;
  const workTimeHours = form.controls.workTimeHours.value;

  const hasPrints = prints.some((print) => isEstampadoPrintValid(print));
  const hasSupplies = supplyLines.some(
    (line) => line.supplyId && Number(line.quantity) > 0,
  );
  const hasValidPressCycles = pressCycles.some(
    (cycle) => Number(cycle.pressMinutes) > 0 && Number(cycle.bajadas) >= 1,
  );

  return (
    hasPrints ||
    hasSupplies ||
    hasValidPressCycles ||
    Number(workTimeHours) > 0
  );
}
