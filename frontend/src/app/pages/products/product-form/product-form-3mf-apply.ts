import { FdmFilamentLine } from '../../../core/models';
import { totalFdmFilamentGrams } from '../../../shared/utils/fdm.helpers';
import { ProductFormGroup } from './services/product-form-state-manager.service';

export interface Apply3mfToProductFormInput {
  filaments: FdmFilamentLine[];
  printTimeHours: number | null;
  purgeGrams: number | null;
  colorChanges: number | null;
}

/**
 * Escribe el resultado del parser .3mf en el mismo FormGroup que edita el
 * usuario (única fuente de verdad para pricing y controles de producción).
 */
export function apply3mfResultToProductForm(
  form: ProductFormGroup,
  input: Apply3mfToProductFormInput,
): void {
  const filaments = input.filaments.length
    ? input.filaments
    : form.controls.filamentLines.value;
  const printTimeHours =
    input.printTimeHours != null
      ? input.printTimeHours
      : form.controls.printTimeHours.value;
  const firstType =
    filaments.find((row) => row.filamentType)?.filamentType ??
    form.controls.filamentType.value;

  form.patchValue({
    filamentLines: filaments,
    filamentType: firstType,
    grams: totalFdmFilamentGrams(filaments),
    printTimeHours: Number(printTimeHours) || 0,
    purgeGrams: input.purgeGrams,
    colorChanges: input.colorChanges,
  });
}
