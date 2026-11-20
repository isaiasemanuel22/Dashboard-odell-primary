import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ProductsService } from '../../../core/services/products.service';
import { FormDialogService } from '../../../modals/public-api';
import { ProductsBulkPriceComponent } from './products-bulk-price.component';

describe('ProductsBulkPriceComponent', () => {
  let fixture: ComponentFixture<ProductsBulkPriceComponent>;
  let component: ProductsBulkPriceComponent;
  const previewBulkPrice = jasmine
    .createSpy('previewBulkPrice')
    .and.returnValue(of({ count: 0, items: [] }));

  beforeEach(async () => {
    previewBulkPrice.calls.reset();
    await TestBed.configureTestingModule({
      imports: [ProductsBulkPriceComponent],
      providers: [
        {
          provide: ProductsService,
          useValue: { previewBulkPrice, applyBulkPrice: () => of({}) },
        },
        {
          provide: FormDialogService,
          useValue: { openConfirm: () => of(false) },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ProductsBulkPriceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('Cancelar emite closed y no vuelve a pedir la vista previa', () => {
    const closed = jasmine.createSpy('closed');
    component.closed.subscribe(closed);
    component.percent = 25;
    component.cancel();
    expect(closed).toHaveBeenCalledTimes(1);
    expect(component.percent).toBe(10);
    expect(component.preview).toBeNull();
    expect(component.previewLoading).toBeFalse();
  });
});
