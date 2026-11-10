import { Injectable } from '@nestjs/common';
import { ProductType } from '../common/enums';
import {
  Product,
  Product3D,
  ProductPricingInput,
  ProductPricingResult,
} from '../common/interfaces';
import { CreateProductDto } from '../common/dto';
import { CostCalculatorService } from '../settings/cost-calculator.service';
import { StoreService } from '../store/store.service';
import {
  normalizeEstampadoPressCycles,
  normalizeEstampadoPrints,
  normalizeEstampadoSupplies,
} from './estampado-product.util';
import { resolveFdmFilaments } from './fdm-product.util';
import { productToPricingInput } from './product-pricing-input.util';

@Injectable()
export class ProductPricingService {
  constructor(
    private readonly costCalculator: CostCalculatorService,
    private readonly store: StoreService,
  ) {}

  resolvePricing(input: ProductPricingInput): ProductPricingResult {
    return this.costCalculator.calculateProductPricing(input);
  }

  productToPricingInput(product: Product): ProductPricingInput {
    return productToPricingInput(product, this.store.products);
  }

  toPricingInput(merged: CreateProductDto): ProductPricingInput {
    const product3d =
      merged.type === ProductType.FDM || merged.type === ProductType.RESINA
        ? (merged as Partial<Product3D>)
        : null;

    const estampadoData = merged.type === ProductType.ESTAMPADO ? merged : null;

    const filaments =
      merged.type === ProductType.FDM
        ? resolveFdmFilaments({
            filaments: product3d?.filaments,
            grams: product3d?.grams,
            filamentType: product3d?.filamentType,
            brand: product3d?.brand,
          })
        : [];

    return {
      type: merged.type,
      components: merged.components,
      assemblyTimeHours: merged.assemblyTimeHours,
      suggestedPrice: merged.suggestedPrice,
      price: merged.price,
      cost: merged.cost,
      grams: product3d?.grams,
      purgeGrams:
        merged.type === ProductType.FDM ? product3d?.purgeGrams : undefined,
      printTimeHours: product3d?.printTimeHours,
      workTimeHours: product3d?.workTimeHours ?? estampadoData?.workTimeHours,
      brand: product3d?.brand,
      filamentType: product3d?.filamentType,
      filaments,
      resinType: product3d?.resinType,
      washMinutes: product3d?.washMinutes,
      cureMinutes: product3d?.cureMinutes,
      estampadoPrints: normalizeEstampadoPrints(
        estampadoData?.estampadoPrints ?? estampadoData?.prints,
        {
          paperType: estampadoData?.paperType,
          impresoId: estampadoData?.impresoId,
          widthCm: estampadoData?.widthCm,
          heightCm: estampadoData?.heightCm,
        },
      ),
      estampadoPressCycles: normalizeEstampadoPressCycles(
        estampadoData?.estampadoPressCycles ?? estampadoData?.pressCycles,
        estampadoData?.pressMinutes,
      ),
      estampadoSupplies: normalizeEstampadoSupplies(
        estampadoData?.estampadoSupplies ??
          estampadoData?.supplies ??
          merged.supplies,
      ),
      preferredPrinterId:
        merged.type === ProductType.FDM
          ? product3d?.preferredPrinterId
          : undefined,
    };
  }
}
