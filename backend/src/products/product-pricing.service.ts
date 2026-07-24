import { Injectable } from '@nestjs/common';
import { ProductType } from '../common/enums';
import {
  Product,
  Product3D,
  ProductEstampado,
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
import { normalizeProductComponents } from './product-component.util';

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
    const components = normalizeProductComponents(
      product.components,
      this.store.products,
    );

    if (product.type === ProductType.COMBO) {
      return {
        type: ProductType.COMBO,
        components,
        assemblyTimeHours: product.assemblyTimeHours ?? 0,
        price: product.price,
        cost: product.cost,
      };
    }

    if (product.type === ProductType.ESTAMPADO) {
      const estampado = product as ProductEstampado;
      return {
        type: ProductType.ESTAMPADO,
        components,
        assemblyTimeHours: product.assemblyTimeHours ?? 0,
        price: product.price,
        cost: product.cost,
        workTimeHours: estampado.workTimeHours,
        estampadoPrints: normalizeEstampadoPrints(estampado.prints),
        estampadoPressCycles: normalizeEstampadoPressCycles(
          estampado.pressCycles,
        ),
        estampadoSupplies: normalizeEstampadoSupplies(estampado.supplies),
      };
    }

    const product3d = product as Product3D;
    return {
      type: product3d.type,
      components,
      assemblyTimeHours: product.assemblyTimeHours ?? 0,
      price: product.price,
      cost: product.cost,
      grams: product3d.grams,
      printTimeHours: product3d.printTimeHours,
      workTimeHours: product3d.workTimeHours,
      brand: product3d.brand,
      filamentType: product3d.filamentType,
      resinType: product3d.resinType,
      washMinutes: product3d.washMinutes,
      cureMinutes: product3d.cureMinutes,
    };
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
