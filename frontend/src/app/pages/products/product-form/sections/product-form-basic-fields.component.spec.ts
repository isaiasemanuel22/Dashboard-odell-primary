import { TestBed } from '@angular/core/testing';
import { ProductType } from '../../../../core/models';
import { ProductFormBasicFieldsComponent } from './product-form-basic-fields.component';

describe('ProductFormBasicFieldsComponent — combo', () => {
  it('un combo siempre emite includesPieces=true (escribir el nombre no vacía las piezas)', async () => {
    await TestBed.configureTestingModule({
      imports: [ProductFormBasicFieldsComponent],
    })
      .overrideComponent(ProductFormBasicFieldsComponent, {
        set: { template: '', imports: [] },
      })
      .compileComponents();
    const fixture = TestBed.createComponent(ProductFormBasicFieldsComponent);
    const component = fixture.componentInstance;
    component.productTypeOptions = [];
    component.type = ProductType.COMBO;
    component.includesPieces = false;
    component.name = 'Kit';
    expect(component.readValue().includesPieces).toBeTrue();

    component.type = ProductType.FDM;
    expect(component.readValue().includesPieces).toBeFalse();
  });
});
