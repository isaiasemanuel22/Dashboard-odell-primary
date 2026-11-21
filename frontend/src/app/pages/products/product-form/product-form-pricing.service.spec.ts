import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup } from '@angular/forms';
import { Product, ProductType } from '../../../core/models';
import { ProductCostCalculationService } from '../../../core/services/product-cost-calculation.service';
import { ProductPricingService } from '../../../core/services/product-pricing.service';
import { SettingsFacade } from '../../../store/settings/settings.facade';
import { ProductFormPricingFacade } from './store/product-form-pricing/product-form-pricing.facade';
import { ProductCostCalculatorService } from './services/product-cost-calculator.service';
import { ProductPayloadBuilderService } from './services/product-payload-builder.service';
import { ProductFormGroup } from './services/product-form-state-manager.service';
import { ProductFormPricingService } from './product-form-pricing.service';

function fakeForm(suggested: number | null): ProductFormGroup {
  return new FormGroup({
    type: new FormControl(ProductType.FDM),
    includesPieces: new FormControl(false),
    suggestedPrice: new FormControl(suggested),
    supplyLines: new FormControl([]),
  }) as unknown as ProductFormGroup;
}

describe('E134: precio cargado distinto del calculado pasa a «Precio fijo»', () => {
  let service: ProductFormPricingService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ProductFormPricingService,
        { provide: ProductPricingService, useValue: { packagingValue: () => 0 } },
        {
          provide: ProductCostCalculationService,
          useValue: { supplyLinesValue: () => 0 },
        },
        { provide: ProductCostCalculatorService, useValue: {} },
        { provide: ProductPayloadBuilderService, useValue: {} },
        {
          provide: SettingsFacade,
          useValue: { peekGeneralSettings: () => null },
        },
        {
          provide: ProductFormPricingFacade,
          useValue: { setSuggestedPrice: () => undefined },
        },
      ],
    });
    service = TestBed.inject(ProductFormPricingService);
  });

  function load(storedPrice: number, calculated: number): void {
    const form = fakeForm(null);
    service.bind({
      form,
      catalogProducts: [],
      product: {
        id: 'p1',
        type: ProductType.FDM,
        price: storedPrice,
      } as unknown as Product,
    });
    service.resetFromState({
      cost: 0,
      costBreakdown: null,
      computedPrice: calculated,
      appliedMarginPercent: null,
    });
  }

  it('pasa a fijo si el precio cargado difiere en $1 o más', () => {
    load(5000, 4000);
    service.adoptFixedModeFromStoredPrice();
    expect(service.fixedPriceMode).toBeTrue();
    expect(service.manualUnitPrice).toBe(5000);
  });

  it('queda calculado si coincide con el calculado', () => {
    load(4000, 4000.4);
    service.adoptFixedModeFromStoredPrice();
    expect(service.fixedPriceMode).toBeFalse();
  });

  it('no pisa el modo que el usuario eligió a mano después de cargar', () => {
    load(5000, 4000);
    service.fixedPriceMode = false;
    service.adoptFixedModeFromStoredPrice();
    expect(service.fixedPriceMode).toBeFalse();
  });

  it('con sugerido cargado arranca en fijo al cargar', () => {
    const form = fakeForm(3000);
    service.bind({
      form,
      catalogProducts: [],
      product: { id: 'p1', type: ProductType.FDM, price: 3000 } as unknown as Product,
    });
    service.resetFromState({
      cost: 0,
      costBreakdown: null,
      computedPrice: 2000,
      appliedMarginPercent: null,
    });
    expect(service.fixedPriceMode).toBeTrue();
    expect(service.manualUnitPrice).toBe(3000);
  });
});
