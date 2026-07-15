import { Injectable } from '@nestjs/common';
import { ProductType } from '../common/enums';
import {
  Product3D,
  ProductPricingInput,
  ProductPricingResult,
} from '../common/interfaces';
import { CreateProductDto } from '../common/dto';
import { CostCalculatorService } from '../settings/cost-calculator.service';
import {
  normalizeEstampadoPressCycles,
  normalizeEstampadoPrints,
  normalizeEstampadoSupplies,
} from './estampado-product.util';

@Injectable()
export class ProductPricingService {
  constructor(private readonly costCalculator: CostCalculatorService) {}

  resolvePricing(input: ProductPricingInput): ProductPricingResult {
    return this.costCalculator.calculateProductPricing(input);
  }

  toPricingInput(merged: CreateProductDto): ProductPricingInput {
    const product3d =
      merged.type === ProductType.FDM || merged.type === ProductType.RESINA
        ? (merged as Partial<Product3D>)
        : null;

    const estampadoData =
      merged.type === ProductType.ESTAMPADO
        ? (merged as CreateProductDto)
        : null;

    return {
      type: merged.type,
      components: merged.components,
      assemblyTimeHours: merged.assemblyTimeHours,
      suggestedPrice: merged.suggestedPrice,
      price: merged.price,
      cost: merged.cost,
      grams: product3d?.grams,
      printTimeHours: product3d?.printTimeHours,
      workTimeHours: product3d?.workTimeHours ?? estampadoData?.workTimeHours,
      brand: product3d?.brand,
      filamentType: product3d?.filamentType,
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
        estampadoData?.estampadoSupplies ?? estampadoData?.supplies,
      ),
    };
  }
}
