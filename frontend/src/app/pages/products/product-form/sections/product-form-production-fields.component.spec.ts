import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { FilamentType, ProductType } from '../../../../core/models';
import { SuppliesService } from '../../../../core/services/settings.service';
import { createFdmFilamentLineId } from '../../../../shared/utils/fdm.helpers';
import { apply3mfResultToProductForm } from '../product-form-3mf-apply';
import { ProductFormStateManagerService } from '../services/product-form-state-manager.service';
import { ProductFormProductionFieldsComponent } from './product-form-production-fields.component';

describe('ProductFormProductionFieldsComponent — sync .3mf', () => {
  let fixture: ComponentFixture<ProductFormProductionFieldsComponent>;
  let component: ProductFormProductionFieldsComponent;
  const stateManager = new ProductFormStateManagerService();

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductFormProductionFieldsComponent],
      providers: [
        {
          provide: SuppliesService,
          useValue: {
            watchSupplies: () => of([]),
          },
        },
      ],
    })
      .overrideComponent(ProductFormProductionFieldsComponent, {
        set: { template: '', imports: [] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ProductFormProductionFieldsComponent);
    component = fixture.componentInstance;
    component.form = stateManager.buildFormGroup(stateManager.createInitialState());
    component.productType = ProductType.FDM;
    component.includesPieces = false;
    fixture.detectChanges();
  });

  it('al aplicar un resultado de parser refleja filas, horas, purga y colorChanges en line/form', () => {
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

    apply3mfResultToProductForm(component.form, {
      filaments,
      printTimeHours: 4.2,
      purgeGrams: 5.2,
      colorChanges: 14,
    });
    fixture.detectChanges();

    expect(component.line.filaments?.length).toBe(2);
    expect(component.line.filaments?.[0]?.grams).toBe(38);
    expect(component.line.filaments?.[1]?.grams).toBe(17);
    expect(component.line.filaments?.[0]?.source).toBe('3mf');
    expect(component.line.printTimeHours).toBe(4.2);
    expect(component.form.controls.purgeGrams.value).toBe(5.2);
    expect(component.form.controls.colorChanges.value).toBe(14);
  });
});
