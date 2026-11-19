import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup } from '@angular/forms';
import { of } from 'rxjs';
import { SuppliesService } from '../../../../core/services/settings.service';
import { SettingsFacade } from '../../../../store/settings/settings.facade';
import { ProductFormFacade } from '../product-form.facade';
import { ProductFormPricingService } from '../product-form-pricing.service';
import { ProductFormPricingFacade } from '../store/product-form-pricing/product-form-pricing.facade';
import { ProductFormPricingSectionComponent } from './product-form-pricing-section.component';

describe('ProductFormPricingSection: precio unitario según el modo', () => {
  function render(fixed: boolean) {
    const pricing = {
      manualUnitPrice: fixed ? 9000 : null,
      fixedPriceMode: fixed,
      fixedPriceMissing: false,
      computedPrice: 7822,
      supplyValue: () => 0,
      supplyPrice: () => 0,
      supplyCostWithError: () => 0,
      packagingValue: () => 0,
      packagingPrice: () => 0,
      heldCatalogPrice: () => null,
      adoptStoredManualPrice: () => undefined,
    };
    const vm = {
      price: 7822,
      totalCost: 5000,
      calculating: false,
      costBreakdown: null,
    };
    TestBed.configureTestingModule({
      imports: [ProductFormPricingSectionComponent],
      providers: [
        { provide: ProductFormPricingFacade, useValue: { vm$: of(vm) } },
        { provide: ProductFormPricingService, useValue: pricing },
        { provide: SettingsFacade, useValue: { watchUntilDestroyed: () => of() } },
        { provide: SuppliesService, useValue: { watchSupplies: () => of([]) } },
      ],
    });
    const fixture = TestBed.createComponent(ProductFormPricingSectionComponent);
    fixture.componentInstance.facade = {
      usesPieceAssembly: false,
      components: [],
      finalPrice: 7822,
    } as unknown as ProductFormFacade;
    const control = (value: unknown = null) => new FormControl(value);
    fixture.componentInstance.form = new FormGroup({
      type: control('FDM'),
      discountPercent: control(),
      discountAmount: control(),
      suggestedPrice: control(0),
      supplyLines: control([]),
      packagingLines: control([]),
      filamentLines: control([]),
    }) as never;
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('Calculado: sin input, muestra el precio como texto', () => {
    const el = render(false);
    expect(el.querySelector('input.unit-price__control')).toBeNull();
    const value = el.querySelector('.unit-price__value');
    expect(value?.textContent?.replace(/\s/g, ' ')).toContain('7.822');
  });

  it('Fijo: muestra el input editable y «Volver al sugerido»', () => {
    const el = render(true);
    expect(el.querySelector('input.unit-price__control')).not.toBeNull();
    expect(el.querySelector('.unit-price__value')).toBeNull();
    expect(el.querySelector('.unit-price__reset')).not.toBeNull();
  });
});
