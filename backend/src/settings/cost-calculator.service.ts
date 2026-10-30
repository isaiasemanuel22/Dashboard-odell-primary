import { BadRequestException, Injectable } from '@nestjs/common';
import {
  FilamentType,
  PaperType,
  MachineProfileRole,
  ProductType,
  ResinType,
  ServiceType,
  SupplyCategory,
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
import { calculatePaperCostFromPricePerSqm } from '../common/paper-cost.util';
import { isDesignService } from '../common/service-type.util';
import {
  buildFdmCostInput,
  isFdmQuoteConfigured,
} from '../orders/order-fdm-quote.util';
import {
  calculateMachineOverhead,
  calcWashSupplyCost,
  getMachineProfilesForProductType,
} from './machine-profile.util';
import {
  resolveFilamentPricePerKg,
  resolveResinPricePerLiter,
} from './material-type-price.util';
import {
  normalizeEstampadoPressCycles,
  normalizeEstampadoPrints,
  normalizeEstampadoSupplies,
  resolvePrintDimensions,
  totalEstampadoPressMinutes,
} from '../products/estampado-product.util';
import {
  hasValidFdmFilamentInput,
  resolveFdmFilaments,
} from '../products/fdm-product.util';
import { normalizeProductComponents } from '../products/product-component.util';
import { normalizeProfitMargins } from './profit-margins.util';

const RESIN_DENSITY_G_PER_ML = 1.1;

@Injectable()
export class CostCalculatorService {
  constructor(private readonly store: StoreService) {}

  calculateCost(dto: CalculateCostDto): CostBreakdown {
    const settings = this.store.generalSettings;
    getMachineProfilesForProductType(settings, dto.type);

    const printTimeHours = Number(dto.printTimeHours) || 0;
    const workTimeHours = Number(dto.workTimeHours) || 0;
    const pressMinutes =
      dto.type === ProductType.ESTAMPADO
        ? totalEstampadoPressMinutes(
            dto.estampadoPressCycles,
            dto.pressMinutes,
          )
        : Number(dto.pressMinutes) || 0;
    const materialCost = this.calculateMaterialCost(dto, settings);
    const overhead = calculateMachineOverhead(settings, dto.type, {
      printTimeHours,
      washMinutes: dto.washMinutes,
      cureMinutes: dto.cureMinutes,
      pressMinutes,
    });
    const laborCost = workTimeHours * settings.laborCostPerHour;
    const errorMarginCost = this.calculateErrorMarginCost(
      materialCost,
      overhead.energyCost,
      overhead.machineCost,
      settings,
    );

    const totalCost = Math.round(
      materialCost +
        overhead.energyCost +
        overhead.machineCost +
        errorMarginCost +
        laborCost,
    );

    return {
      materialCost: Math.round(materialCost),
      energyCost: overhead.energyCost,
      machineCost: overhead.machineCost,
      errorMarginCost,
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
    const paperCost = calculatePaperCostFromPricePerSqm(
      pricePerSqm,
      widthCm,
      heightCm,
    );

    return {
      areaSqm: Math.round(areaSqm * 10000) / 10000,
      paperCost,
    };
  }

  sumComponentsCost(components: ProductComponent[]): number {
    return components.reduce((sum, item) => {
      const unitCost = this.resolveProductUnitCost(item.productId);
      return sum + unitCost * Number(item.quantity);
    }, 0);
  }

  resolveProductUnitCost(
    productId: string,
    visiting: Set<string> = new Set(),
  ): number {
    if (visiting.has(productId)) {
      return 0;
    }

    const product = this.store.getProductById(productId);
    if (!product) {
      throw new BadRequestException(
        `Producto pieza ${productId} no encontrado`,
      );
    }

    const components = normalizeProductComponents(
      product.components,
      this.store.products,
    );
    const usesPieceAssembly =
      product.type === ProductType.COMBO ||
      product.includesPieces === true ||
      components.length > 0;

    if (!usesPieceAssembly || components.length === 0) {
      return product.cost ?? 0;
    }

    visiting.add(productId);
    const partsCost = components.reduce((sum, item) => {
      return (
        sum +
        this.resolveProductUnitCost(item.productId, visiting) *
          Number(item.quantity)
      );
    }, 0);
    visiting.delete(productId);

    return partsCost;
  }

  sumComponentsPrice(components: ProductComponent[]): number {
    return components.reduce((sum, item) => {
      const unitPrice = this.resolveProductUnitPrice(item.productId);
      return sum + unitPrice * Number(item.quantity);
    }, 0);
  }

  resolveProductUnitPrice(
    productId: string,
    visiting: Set<string> = new Set(),
  ): number {
    if (visiting.has(productId)) {
      return 0;
    }

    const product = this.store.getProductById(productId);
    if (!product) {
      throw new BadRequestException(
        `Producto pieza ${productId} no encontrado`,
      );
    }

    const components = normalizeProductComponents(
      product.components,
      this.store.products,
    );
    const usesPieceAssembly =
      product.type === ProductType.COMBO ||
      product.includesPieces === true ||
      components.length > 0;

    if (!usesPieceAssembly || components.length === 0) {
      return product.price ?? 0;
    }

    visiting.add(productId);
    const partsPrice = components.reduce((sum, item) => {
      return (
        sum +
        this.resolveProductUnitPrice(item.productId, visiting) *
          Number(item.quantity)
      );
    }, 0);
    visiting.delete(productId);

    return partsPrice;
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
        errorMarginCost: 0,
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
      errorMarginCost: 0,
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
      const fdmFilaments =
        input.type === ProductType.FDM ? resolveFdmFilaments(input) : [];
      const hasFdmMaterial = hasValidFdmFilamentInput(fdmFilaments);
      const grams = Number(input.grams) || 0;
      if (
        hasFdmMaterial ||
        (input.type === ProductType.RESINA && grams > 0) ||
        (input.type === ProductType.FDM && grams > 0 && !fdmFilaments.length)
      ) {
        breakdown = this.calculateCost(this.toCalculateCostDto(input));
        cost = breakdown.totalCost;
      } else {
        cost = Number(input.cost) || 0;
      }
    } else if (input.type === ProductType.ESTAMPADO) {
      const workTimeHours = Number(input.workTimeHours) || 0;
      const totalPressMinutes = totalEstampadoPressMinutes(
        input.estampadoPressCycles,
        input.pressMinutes,
      );
      const hasPaperCost = this.hasEstampadoPaperCost(input);
      const hasSupplyCost = this.hasEstampadoSupplyCost(input);
      if (totalPressMinutes > 0 || workTimeHours > 0 || hasPaperCost || hasSupplyCost) {
        breakdown = this.calculateCost(this.toCalculateCostDto(input));
        cost = breakdown.totalCost;
      } else {
        cost = Number(input.cost) || 0;
      }
    } else {
      cost = Number(input.cost) || 0;
    }

    const storedCost = Number(input.cost) || 0;
    if (cost <= 0 && storedCost > 0) {
      cost = storedCost;
      if (breakdown?.totalCost === 0) {
        breakdown = null;
      }
    }

    const price = this.resolveProductPrice(input, hasComponents, cost);
    const profit = price - cost;
    const configuredMarginPercent = this.getMarginForProductType(input.type);

    return {
      cost,
      price,
      profit,
      marginPercent: price > 0 ? Math.round((profit / price) * 100) : 0,
      configuredMarginPercent,
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
      const componentsPrice = this.sumComponentsPrice(input.components ?? []);
      if (componentsPrice > 0) {
        return componentsPrice;
      }
    }

    const margin = this.getMarginForProductType(input.type);
    if (cost > 0) {
      return this.priceFromCostAndMargin(cost, margin);
    }

    return Number(input.price) || 0;
  }

  getMarginForService(service: ServiceType): number {
    const margins = normalizeProfitMargins(
      this.store.generalSettings.profitMargins,
    );
    return margins[service] ?? 0;
  }

  getMarginForProductType(type: ProductType): number {
    switch (type) {
      case ProductType.FDM:
      case ProductType.RESINA:
        return this.getMarginForService(ServiceType.IMPRESION_3D);
      case ProductType.ESTAMPADO:
        return this.getMarginForService(ServiceType.ESTAMPADO);
      case ProductType.COMBO:
        return this.getMarginForService(ServiceType.IMPRESION_3D);
      default:
        return 0;
    }
  }

  getProfileForProductType(type: ProductType) {
    return getMachineProfilesForProductType(this.store.generalSettings, type);
  }

  priceFromCostAndMargin(cost: number, marginPercent: number): number {
    const markup = Math.min(Math.max(Number(marginPercent) || 0, 0), 999);
    if (markup === 0) {
      return Math.round(cost);
    }
    return Math.round(cost * (1 + markup / 100));
  }

  costFromPriceAndMargin(price: number, marginPercent: number): number {
    const markup = Math.min(Math.max(Number(marginPercent) || 0, 0), 999);
    if (price <= 0) return 0;
    if (markup === 0) return Math.round(price);
    return Math.round(price / (1 + markup / 100));
  }

  /**
   * Costo de un servicio de diseño/modelado según tarifa × horas (§16.2).
   * No se deduce del precio al cliente: con tarifa $0 el costo es $0.
   */
  resolveDesignUnitCost(
    unitPrice: number,
    serviceType: ServiceType = ServiceType.DISENO_GRAFICO,
    budgetedHours = 0,
  ): number {
    const settings = this.store.generalSettings;
    const rate =
      serviceType === ServiceType.MODELADO
        ? Number(settings.modelingRatePerHour) || 0
        : Number(settings.graphicDesignRatePerHour) || 0;
    const hours = Number(budgetedHours) || 0;
    if (rate > 0 && hours > 0) {
      return Math.round(rate * hours);
    }
    // Compat: sin tarifa ni horas, no inventar costo desde el precio.
    if (rate <= 0) {
      return 0;
    }
    const margins = normalizeProfitMargins(settings.profitMargins);
    const margin =
      serviceType === ServiceType.MODELADO
        ? margins.modelado
        : margins.diseno_grafico;
    return this.costFromPriceAndMargin(unitPrice, margin);
  }

  resolveCatalogUnitPrice(productId: string): number {
    const product = this.store.getProductById(productId);
    if (!product) {
      throw new BadRequestException(`Producto ${productId} no encontrado`);
    }
    return product.price;
  }

  resolveCatalogUnitCost(productId: string): number {
    try {
      return this.resolveProductUnitCost(productId);
    } catch {
      return 0;
    }
  }

  resolveFdmQuoteUnitCost(
    item: Parameters<typeof buildFdmCostInput>[0],
  ): number {
    if (!isFdmQuoteConfigured(item)) return 0;
    return this.calculateCost(buildFdmCostInput(item)).totalCost;
  }

  resolveOrderItemUnitCost(item: {
    productId?: string;
    unitPrice: number;
    serviceType?: ServiceType;
    grams?: number;
    printTimeHours?: number;
    filamentType?: FilamentType;
    budgetedHours?: number;
    includesPrint?: boolean;
    printPaperType?: PaperType;
    printWidthCm?: number;
    printLengthCm?: number;
  }): number {
    if (
      item.serviceType === ServiceType.IMPRESION_3D &&
      isFdmQuoteConfigured(item)
    ) {
      return this.resolveFdmQuoteUnitCost(item);
    }
    if (item.productId) {
      return this.resolveCatalogUnitCost(item.productId);
    }
    const serviceType = item.serviceType ?? ServiceType.DISENO_GRAFICO;
    let cost = this.resolveDesignUnitCost(
      item.unitPrice,
      serviceType,
      item.budgetedHours,
    );
    if (
      item.includesPrint &&
      item.printPaperType &&
      Number(item.printWidthCm) > 0 &&
      Number(item.printLengthCm) > 0
    ) {
      cost += this.calculateImpresoPaperCost(
        item.printPaperType,
        Number(item.printWidthCm),
        Number(item.printLengthCm),
      ).paperCost;
    }
    return Math.round(cost);
  }

  resolveOrderUnitPrice(
    serviceType: ServiceType,
    productId: string | undefined,
    clientUnitPrice: number,
  ): number {
    if (isDesignService(serviceType) || !productId) {
      return clientUnitPrice;
    }

    if (Number.isFinite(clientUnitPrice) && clientUnitPrice > 0) {
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
      const linked = this.store.brands?.find(
        (entry) => entry.name.toLowerCase() === brand.toLowerCase(),
      )?.id;
      const exact = matches.find((price) =>
        price.brandId && linked
          ? price.brandId === linked
          : price.brand?.toLowerCase() === brand.toLowerCase(),
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
      const linked = this.store.brands?.find(
        (entry) => entry.name.toLowerCase() === brand.toLowerCase(),
      )?.id;
      const exact = matches.find((price) =>
        price.brandId && linked
          ? price.brandId === linked
          : price.brand?.toLowerCase() === brand.toLowerCase(),
      );
      if (exact) return exact.pricePerLiter;
    }

    const total = matches.reduce((sum, p) => sum + p.pricePerLiter, 0);
    return total / matches.length;
  }

  getUnitPriceForSupply(
    category: SupplyCategory,
    brand?: string,
    filamentType?: FilamentType,
    resinType?: ResinType,
  ): { unitPrice: number; unit: string; fromSettings: boolean } | null {
    if (category === SupplyCategory.FDM) {
      const price = this.getDefaultFilamentPrice(brand, filamentType);
      if (price === null) return null;
      return { unitPrice: price, unit: 'kg', fromSettings: true };
    }
    if (category === SupplyCategory.RESINA && resinType) {
      const price = this.getDefaultResinPrice(brand, resinType);
      if (price === null) return null;
      return { unitPrice: price, unit: 'L', fromSettings: true };
    }
    if (category === SupplyCategory.RESINA && !resinType) {
      const washSupplies = this.store.supplies.filter(
        (supply) => supply.category === SupplyCategory.RESINA && !supply.resinType,
      );
      if (!washSupplies.length) return null;
      const total = washSupplies.reduce(
        (sum, supply) => sum + Number(supply.unitPrice),
        0,
      );
      return {
        unitPrice: total / washSupplies.length,
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
      filaments: input.filaments,
      resinType: input.resinType,
      paperType: input.paperType,
      widthCm: input.widthCm,
      heightCm: input.heightCm,
      estampadoPrints: input.estampadoPrints,
      estampadoPressCycles: input.estampadoPressCycles,
      estampadoSupplies: input.estampadoSupplies,
    };
  }

  private hasEstampadoSupplyCost(input: ProductPricingInput): boolean {
    return normalizeEstampadoSupplies(input.estampadoSupplies).length > 0;
  }

  private hasEstampadoPaperCost(input: ProductPricingInput): boolean {
    const prints = normalizeEstampadoPrints(input.estampadoPrints, {
      paperType: input.paperType,
      impresoId: undefined,
      widthCm: input.widthCm,
      heightCm: input.heightCm,
    });
    if (prints.length) {
      return prints.some(
        (print) =>
          resolvePrintDimensions(print, (id) =>
            this.store.getImpresoById(id),
          ) != null,
      );
    }
    const widthCm = Number(input.widthCm) || 0;
    const heightCm = Number(input.heightCm) || 0;
    return Boolean(input.paperType) && widthCm > 0 && heightCm > 0;
  }

  private calculateMaterialCost(
    dto: CalculateCostDto,
    settings: GeneralSettings,
  ): number {
    const grams = Number(dto.grams) || 0;

    if (dto.type === ProductType.FDM) {
      const filaments = resolveFdmFilaments(dto);
      if (filaments.length) {
        return filaments.reduce(
          (sum, line) =>
            sum +
            this.calcFilamentCost(
              line.brand,
              line.filamentType,
              line.grams,
              settings,
            ),
          0,
        );
      }
      return this.calcFilamentCost(dto.brand, dto.filamentType, grams, settings);
    }
    if (dto.type === ProductType.RESINA) {
      return (
        this.calcResinCost(dto.brand, dto.resinType, grams, settings) +
        calcWashSupplyCost(settings, this.store.supplies, dto.type)
      );
    }
    if (dto.type === ProductType.ESTAMPADO) {
      return this.calcEstampadoMaterialCost(dto);
    }
    return 0;
  }

  private calcEstampadoMaterialCost(dto: CalculateCostDto): number {
    const prints = normalizeEstampadoPrints(dto.estampadoPrints, {
      paperType: dto.paperType,
      impresoId: undefined,
      widthCm: dto.widthCm,
      heightCm: dto.heightCm,
    });

    let paperCost = 0;
    if (prints.length) {
      paperCost = prints.reduce((sum, print) => {
        const dims = resolvePrintDimensions(print, (id) =>
          this.store.getImpresoById(id),
        );
        if (!dims) {
          return sum;
        }
        const quantity = Math.max(1, Math.round(Number(print.quantity) || 1));
        return (
          sum +
          this.calculateImpresoPaperCost(
            dims.paperType,
            dims.widthCm,
            dims.heightCm,
          ).paperCost *
            quantity
        );
      }, 0);
    } else {
      const widthCm = Number(dto.widthCm) || 0;
      const heightCm = Number(dto.heightCm) || 0;
      if (dto.paperType && widthCm > 0 && heightCm > 0) {
        paperCost = this.calculateImpresoPaperCost(
          dto.paperType,
          widthCm,
          heightCm,
        ).paperCost;
      }
    }

    const supplyCost = normalizeEstampadoSupplies(dto.estampadoSupplies).reduce(
      (sum, line) => {
        const supply = this.store.getSupplyById(line.supplyId);
        if (!supply) {
          return sum;
        }
        return sum + Number(supply.unitPrice) * Number(line.quantity);
      },
      0,
    );

    return paperCost + supplyCost;
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
    const pricePerKg = brand
      ? this.getDefaultFilamentPrice(brand, materialType)
      : resolveFilamentPricePerKg(settings, materialType);
    if (pricePerKg === null) return 0;
    return (grams / 1000) * pricePerKg;
  }

  private calcResinCost(
    brand: string | undefined,
    resinType: ResinType | undefined,
    grams: number,
    settings: GeneralSettings,
  ): number {
    const pricePerLiter = brand
      ? this.getDefaultResinPrice(brand, resinType)
      : resolveResinPricePerLiter(settings, resinType);
    if (pricePerLiter === null) return 0;
    const liters = grams / (RESIN_DENSITY_G_PER_ML * 1000);
    return liters * pricePerLiter;
  }

  private calculateErrorMarginCost(
    materialCost: number,
    energyCost: number,
    machineCost: number,
    settings: GeneralSettings,
  ): number {
    const percent = Math.min(
      Math.max(Number(settings.errorMarginPercent) || 0, 0),
      100,
    );
    if (percent === 0) {
      return 0;
    }
    const base = materialCost + energyCost + machineCost;
    return Math.round(base * (percent / 100));
  }
}
