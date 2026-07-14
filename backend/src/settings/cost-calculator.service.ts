import { BadRequestException, Injectable } from '@nestjs/common';
import {
  FilamentType,
  PaperType,
  MachineProfileRole,
  ProductType,
  ResinType,
  ServiceType,
  SupplyType,
} from '../common/enums';
import {
  CalculateCostDto,
  CostBreakdown,
  GeneralSettings,
  ImpresoCostPreview,
  ProductComponent,
  ProductPricingInput,
  ProductPricingResult,
} from '../common/interfaces';
import { StoreService } from '../store/store.service';
import {
  calculateMachineOverhead,
  calcWashSupplyCost,
  getMachineProfilesForProductType,
} from './machine-profile.util';

const RESIN_DENSITY_G_PER_ML = 1.1;

@Injectable()
export class CostCalculatorService {
  constructor(private readonly store: StoreService) {}

  calculateCost(dto: CalculateCostDto): CostBreakdown {
    const settings = this.store.generalSettings;
    getMachineProfilesForProductType(settings, dto.type);

    const printTimeHours = Number(dto.printTimeHours) || 0;
    const workTimeHours = Number(dto.workTimeHours) || 0;
    const materialCost = this.calculateMaterialCost(dto, settings);
    const overhead = calculateMachineOverhead(settings, dto.type, {
      printTimeHours,
      washMinutes: dto.washMinutes,
      cureMinutes: dto.cureMinutes,
      pressMinutes: dto.pressMinutes,
    });
    const laborCost = workTimeHours * settings.laborCostPerHour;

    const totalCost = Math.round(
      materialCost +
        overhead.energyCost +
        overhead.machineCost +
        laborCost,
    );

    return {
      materialCost: Math.round(materialCost),
      energyCost: overhead.energyCost,
      machineCost: overhead.machineCost,
      laborCost: Math.round(laborCost),
      totalCost,
    };
  }

  calculateImpresoPaperCost(
    paperType: PaperType,
    widthCm: number,
    heightCm: number,
  ): ImpresoCostPreview {
    if (widthCm <= 0 || heightCm <= 0) {
      return { areaSqm: 0, paperCost: 0 };
    }

    const areaSqm = (widthCm * heightCm) / 10000;
    const pricePerSqm = this.getPaperPricePerSqm(paperType);

    return {
      areaSqm: Math.round(areaSqm * 10000) / 10000,
      paperCost: Math.round(areaSqm * pricePerSqm),
    };
  }

  sumComponentsCost(components: ProductComponent[]): number {
    return components.reduce((sum, item) => {
      const part = this.store.getProductById(item.productId);
      if (!part) {
        throw new BadRequestException(
          `Producto pieza ${item.productId} no encontrado`,
        );
      }
      return sum + part.cost * Number(item.quantity);
    }, 0);
  }

  sumComponentsPrice(components: ProductComponent[]): number {
    return components.reduce((sum, item) => {
      const part = this.store.getProductById(item.productId);
      if (!part) {
        throw new BadRequestException(
          `Producto pieza ${item.productId} no encontrado`,
        );
      }
      return sum + part.price * Number(item.quantity);
    }, 0);
  }

  calculateCompositeCost(
    components: ProductComponent[],
    assemblyTimeHours: number,
    productType: ProductType = ProductType.FDM,
  ): CostBreakdown {
    const partsCost = this.sumComponentsCost(components);
    const assemblyHours = Number(assemblyTimeHours) || 0;

    if (assemblyHours <= 0) {
      return {
        materialCost: partsCost,
        energyCost: 0,
        machineCost: 0,
        laborCost: 0,
        totalCost: partsCost,
      };
    }

    const laborBreakdown = this.calculateCost({
      type: productType,
      grams: 0,
      printTimeHours: 0,
      workTimeHours: assemblyHours,
    });

    return {
      materialCost: partsCost,
      energyCost: 0,
      machineCost: 0,
      laborCost: laborBreakdown.laborCost,
      totalCost: partsCost + laborBreakdown.laborCost,
    };
  }

  calculateProductPricing(input: ProductPricingInput): ProductPricingResult {
    const components = input.components ?? [];
    const hasComponents = components.length > 0;
    let breakdown: CostBreakdown | null = null;
    let cost: number;

    if (hasComponents) {
      breakdown = this.calculateCompositeCost(
        components,
        input.assemblyTimeHours ?? 0,
        input.type,
      );
      cost = breakdown.totalCost;
    } else if (input.type === ProductType.FDM || input.type === ProductType.RESINA) {
      const grams = Number(input.grams) || 0;
      if (grams > 0) {
        breakdown = this.calculateCost(this.toCalculateCostDto(input));
        cost = breakdown.totalCost;
      } else {
        cost = Number(input.cost) || 0;
      }
    } else if (input.type === ProductType.ESTAMPADO) {
      const pressMinutes = Number(input.pressMinutes) || 0;
      if (pressMinutes > 0 || Number(input.workTimeHours) > 0) {
        breakdown = this.calculateCost(this.toCalculateCostDto(input));
        cost = breakdown.totalCost;
      } else {
        cost = Number(input.cost) || 0;
      }
    } else {
      cost = Number(input.cost) || 0;
    }

    const price = this.resolveProductPrice(input, hasComponents, cost);
    const profit = price - cost;

    return {
      cost,
      price,
      profit,
      marginPercent: price > 0 ? Math.round((profit / price) * 100) : 0,
      breakdown,
    };
  }

  resolveProductPrice(
    input: ProductPricingInput,
    hasComponents = (input.components ?? []).length > 0,
    cost = Number(input.cost) || 0,
  ): number {
    if (
      input.suggestedPrice != null &&
      Number(input.suggestedPrice) > 0
    ) {
      return Number(input.suggestedPrice);
    }

    if (hasComponents) {
      return this.sumComponentsPrice(input.components ?? []);
    }

    const margin = this.getMarginForProductType(input.type);
    if (cost > 0) {
      return this.priceFromCostAndMargin(cost, margin);
    }

    return Number(input.price) || 0;
  }

  getMarginForService(service: ServiceType): number {
    const margins = this.store.generalSettings.profitMargins ?? {
      impresion_3d: 0,
      diseno: 0,
      estampado: 0,
    };
    return margins[service] ?? 0;
  }

  getMarginForProductType(type: ProductType): number {
    switch (type) {
      case ProductType.FDM:
      case ProductType.RESINA:
        return this.getMarginForService(ServiceType.IMPRESION_3D);
      case ProductType.ESTAMPADO:
        return this.getMarginForService(ServiceType.ESTAMPADO);
      default:
        return 0;
    }
  }

  getProfileForProductType(type: ProductType) {
    return getMachineProfilesForProductType(this.store.generalSettings, type);
  }

  priceFromCostAndMargin(cost: number, marginPercent: number): number {
    const margin = Math.min(Math.max(Number(marginPercent) || 0, 0), 99);
    if (margin === 0) {
      return Math.round(cost);
    }
    return Math.round(cost / (1 - margin / 100));
  }

  resolveCatalogUnitPrice(productId: string): number {
    const product = this.store.getProductById(productId);
    if (!product) {
      throw new BadRequestException(`Producto ${productId} no encontrado`);
    }
    return product.price;
  }

  resolveOrderUnitPrice(
    serviceType: ServiceType,
    productId: string | undefined,
    clientUnitPrice: number,
  ): number {
    if (serviceType === ServiceType.DISENO || !productId) {
      return clientUnitPrice;
    }
    return this.resolveCatalogUnitPrice(productId);
  }

  getDefaultFilamentPrice(
    brand: string | undefined,
    materialType: FilamentType | undefined,
  ): number | null {
    if (!materialType) return null;

    const matches = this.store.generalSettings.filamentPrices.filter(
      (p) => p.materialType === materialType,
    );
    if (!matches.length) return null;

    if (brand) {
      const exact = matches.find(
        (p) => p.brand.toLowerCase() === brand.toLowerCase(),
      );
      if (exact) return exact.pricePerKg;
    }

    const total = matches.reduce((sum, p) => sum + p.pricePerKg, 0);
    return total / matches.length;
  }

  getDefaultResinPrice(
    brand: string | undefined,
    resinType: ResinType | undefined,
  ): number | null {
    if (!resinType) return null;

    const matches = this.store.generalSettings.resinPrices.filter(
      (p) => p.resinType === resinType,
    );
    if (!matches.length) return null;

    if (brand) {
      const exact = matches.find(
        (p) => p.brand.toLowerCase() === brand.toLowerCase(),
      );
      if (exact) return exact.pricePerLiter;
    }

    const total = matches.reduce((sum, p) => sum + p.pricePerLiter, 0);
    return total / matches.length;
  }

  getUnitPriceForSupply(
    type: SupplyType,
    brand?: string,
    filamentType?: FilamentType,
    resinType?: ResinType,
  ): { unitPrice: number; unit: string; fromSettings: boolean } | null {
    if (type === SupplyType.FILAMENTO) {
      const price = this.getDefaultFilamentPrice(brand, filamentType);
      if (price === null) return null;
      return { unitPrice: price, unit: 'kg', fromSettings: true };
    }
    if (type === SupplyType.RESINA) {
      const price = this.getDefaultResinPrice(brand, resinType);
      if (price === null) return null;
      return { unitPrice: price, unit: 'L', fromSettings: true };
    }
    if (type === SupplyType.ALCOHOL) {
      const alcoholSupplies = this.store.supplies.filter(
        (supply) => supply.type === SupplyType.ALCOHOL,
      );
      if (!alcoholSupplies.length) return null;
      const total = alcoholSupplies.reduce(
        (sum, supply) => sum + Number(supply.unitPrice),
        0,
      );
      return {
        unitPrice: total / alcoholSupplies.length,
        unit: 'L',
        fromSettings: false,
      };
    }
    return null;
  }

  private toCalculateCostDto(input: ProductPricingInput): CalculateCostDto {
    return {
      type: input.type,
      grams: input.grams,
      printTimeHours: input.printTimeHours,
      workTimeHours: input.workTimeHours,
      washMinutes: input.washMinutes,
      cureMinutes: input.cureMinutes,
      pressMinutes: input.pressMinutes,
      quantity: input.quantity,
      brand: input.brand,
      filamentType: input.filamentType,
      resinType: input.resinType,
    };
  }

  private calculateMaterialCost(
    dto: CalculateCostDto,
    settings: GeneralSettings,
  ): number {
    const grams = Number(dto.grams) || 0;

    if (dto.type === ProductType.FDM) {
      return this.calcFilamentCost(dto.brand, dto.filamentType, grams, settings);
    }
    if (dto.type === ProductType.RESINA) {
      return (
        this.calcResinCost(dto.brand, dto.resinType, grams, settings) +
        calcWashSupplyCost(settings, this.store.supplies, dto.type)
      );
    }
    return 0;
  }

  private getPaperPricePerSqm(paperType: PaperType): number {
    const prices = this.store.generalSettings.paperPricesPerSqm;
    switch (paperType) {
      case PaperType.SUBLIMACION:
        return prices.sublimacion;
      case PaperType.DTF:
        return prices.dtf;
      case PaperType.DTF_UV:
        return prices.dtfUv;
      default:
        return 0;
    }
  }

  private calcFilamentCost(
    brand: string | undefined,
    materialType: FilamentType | undefined,
    grams: number,
    settings: GeneralSettings,
  ): number {
    const pricePerKg = this.getDefaultFilamentPrice(brand, materialType);
    if (pricePerKg === null) return 0;
    return (grams / 1000) * pricePerKg;
  }

  private calcResinCost(
    brand: string | undefined,
    resinType: ResinType | undefined,
    grams: number,
    settings: GeneralSettings,
  ): number {
    const pricePerLiter = this.getDefaultResinPrice(brand, resinType);
    if (pricePerLiter === null) return 0;
    const liters = grams / (RESIN_DENSITY_G_PER_ML * 1000);
    return liters * pricePerLiter;
  }
}
