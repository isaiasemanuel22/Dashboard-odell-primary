import { FilamentType, ProductType } from '../../../core/models';
import { createFdmFilamentLineId } from '../../../shared/utils/fdm.helpers';
import { apply3mfResultToProductForm } from './product-form-3mf-apply';
import { ProductFormStateManagerService } from './services/product-form-state-manager.service';

describe('apply3mfResultToProductForm', () => {
  const stateManager = new ProductFormStateManagerService();

  it('aplica filas, horas, purga y colorChanges al FormGroup (fuente de verdad)', () => {
    const form = stateManager.buildFormGroup(stateManager.createInitialState());
    expect(form.controls.type.value).toBe(ProductType.FDM);

    const filaments = [
      {
        id: createFdmFilamentLineId(),
        filamentType: FilamentType.PLA,
        grams: 38,
        colorId: 'c-black',
        source: '3mf' as const,
      },
      {
        id: createFdmFilamentLineId(),
        filamentType: FilamentType.PLA,
        grams: 17,
        colorId: 'c-red',
        source: '3mf' as const,
      },
    ];

    apply3mfResultToProductForm(form, {
      filaments,
      printTimeHours: 4.2,
      purgeGrams: 5.2,
      colorChanges: 14,
    });

    expect(form.controls.filamentLines.value).toEqual(filaments);
    expect(form.controls.grams.value).toBe(55);
    expect(form.controls.printTimeHours.value).toBe(4.2);
    expect(form.controls.purgeGrams.value).toBe(5.2);
    expect(form.controls.colorChanges.value).toBe(14);
    expect(form.controls.filamentType.value).toBe(FilamentType.PLA);
  });

  it('respeta ediciones posteriores del usuario sobre el mismo form', () => {
    const form = stateManager.buildFormGroup(stateManager.createInitialState());

    apply3mfResultToProductForm(form, {
      filaments: [
        {
          id: createFdmFilamentLineId(),
          filamentType: FilamentType.PLA,
          grams: 38,
          source: '3mf',
        },
      ],
      printTimeHours: 4.2,
      purgeGrams: 5.2,
      colorChanges: 14,
    });

    form.patchValue({
      filamentLines: [
        {
          id: createFdmFilamentLineId(),
          filamentType: FilamentType.PLA,
          grams: 40,
          source: null,
        },
      ],
      printTimeHours: 5,
      purgeGrams: 6,
    });

    expect(form.controls.filamentLines.value[0]?.grams).toBe(40);
    expect(form.controls.printTimeHours.value).toBe(5);
    expect(form.controls.purgeGrams.value).toBe(6);
  });
});
