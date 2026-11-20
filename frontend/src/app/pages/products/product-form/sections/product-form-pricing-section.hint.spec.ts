import { ChangeDetectorRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup } from '@angular/forms';
import { of } from 'rxjs';
import { SuppliesService } from '../../../../core/services/settings.service';
import { SettingsFacade } from '../../../../store/settings/settings.facade';
import { ProductFormFacade } from '../product-form.facade';
import { ProductFormPricingService } from '../product-form-pricing.service';
import { ProductFormPricingFacade } from '../store/product-form-pricing/product-form-pricing.facade';
import { ProductFormPricingSectionComponent } from './product-form-pricing-section.component';

describe('ProductFormPricingSection: texto «Calculado» con precio fijo', () => {
  const nbsp = /\s/g;
  const norm = (text: string) => text.replace(nbsp, ' ');

  function build(opts: { combo: boolean; fixed: number; computed: number }) {
    const pricing = {
      manualUnitPrice: opts.fixed,
      fixedPriceMode: true,
      computedPrice: opts.computed,
      supplyPrice: () => 500,
      packagingPrice: () => 250,
      supplyCostWithError: () => 0,
      packagingValue: () => 0,
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: ChangeDetectorRef, useValue: { markForCheck: () => undefined } },
        { provide: ProductFormPricingFacade, useValue: { vm$: of(null) } },
        { provide: ProductFormPricingService, useValue: pricing },
        {
          provide: SettingsFacade,
          useValue: { watchUntilDestroyed: () => of() },
        },
        { provide: SuppliesService, useValue: { watchSupplies: () => of([]) } },
      ],
    });
    const component = TestBed.runInInjectionContext(
      () => new ProductFormPricingSectionComponent(),
    );
    component.facade = {
      usesPieceAssembly: opts.combo,
    } as unknown as ProductFormFacade;
    component.form = new FormGroup({
      discountPercent: new FormControl(null),
      discountAmount: new FormControl(null),
    }) as never;
    return component;
  }

  it('producto no combo: muestra el calculado real, no el fijo', () => {
    const c = build({ combo: false, fixed: 9000, computed: 7822 });
    const hint = norm(c.unitPriceHint(9000, 5000, 0));
    expect(hint).toContain('Calculado $ 7.822');
    expect(hint).toContain('precio manual');
  });

  it('combo: calculado = piezas + insumos + packaging', () => {
    const c = build({ combo: true, fixed: 10000, computed: 8322 });
    const hint = norm(c.unitPriceHint(10000, 5000, 0));
    expect(hint).toContain('Calculado $ 9.072');
  });
});
