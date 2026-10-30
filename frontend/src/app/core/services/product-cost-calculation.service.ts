import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import {
  CalculateCostPayload,
  CostBreakdown,
  FilamentType,
  GeneralSettings,
  ImpresoWithCost,
  MachineProfileRole,
  PaperType,
  ProductType,
  ResinType,
  Supply,
} from '../models';
import {
  calculatePaperCostFromPricePerSqm,
  paperReferenceKey,
} from '../../shared/utils/paper-cost.util';
import { selectImpresos } from '../../store/impresos/impresos.selectors';
import { selectSupplies } from '../../store/supplies/supplies.selectors';
import { resolveFdmFilaments } from '../../shared/utils/fdm.helpers';
import {
  normalizeEstampadoPressCycles,
  normalizeEstampadoPrints,
  normalizeEstampadoSupplies,
  resolvePrintDimensions,
  totalEstampadoPressMinutes,
} from '../../shared/utils/estampado.helpers';
import {
  calcWashSupplyCost,
  calculateMachineOverhead,
  calculateMachineOverheadForRole,
  getMachineProfilesForProductType,
  resolveWashBathUses,
} from '../../shared/utils/machine-profile.util';
import {
  RESIN_DENSITY_G_PER_ML,
  resolveFilamentPricePerKg,
  resolveResinPricePerLiter,
} from '../../shared/utils/material-type-price.util';

export interface ProductCostCalculationContext {
  settings: GeneralSettings;
  supplies?: Supply[];
  impresos?: ImpresoWithCost[];
}

/** Desglose visual de costo de resina (order-form); no cambia el total. */
export interface ResinCostParts {
  resinCost: number;
  washSupplyCost: number;
  washMachineCost: number;
  cureMachineCost: number;
  printCost: number;
  printEnergyCost: number;
  printMachineCost: number;
  washMinutes: number;
  cureMinutes: number;
  printHours: number;
  washSupplyName: string | null;
  washConsumptionMl: number;
  washBathUses: number;
}

@Injectable({ providedIn: 'root' })
export class ProductCostCalculationService {
  private readonly store = inject(Store);

  private readonly suppliesSignal = this.store.selectSignal(selectSupplies);
  private readonly impresosSignal = this.store.selectSignal(selectImpresos);

  calculateCost(
    dto: CalculateCostPayload,
    context: ProductCostCalculationContext,
  ): CostBreakdown {
    const settings = context.settings;
    // [] vacío no debe tapar el store (order-form a veces aún no cargó supplies).
    const supplies = context.supplies?.length
      ? context.supplies
      : this.suppliesSignal();
    const impresos = context.impresos?.length
      ? context.impresos
      : this.impresosSignal();

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

    const materialCost = this.calculateMaterialCost(
      dto,
      settings,
      supplies,
      impresos,
    );
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
    settings: GeneralSettings,
    paperType: PaperType,
    widthCm: number,
    heightCm: number,
  ): number {
    const pricePerSqm =
      settings.paperPricesPerSqm[paperReferenceKey(paperType)];
    return calculatePaperCostFromPricePerSqm(pricePerSqm, widthCm, heightCm);
  }

  /**
   * Partes del costo de una línea RESINA para la composición visual.
   * materialCost del breakdown = resinCost + washSupplyCost;
   * energy+machine = print + lavado + curado.
   */
  buildResinCostParts(
    dto: CalculateCostPayload,
    context: ProductCostCalculationContext,
  ): ResinCostParts {
    const settings = context.settings;
    const supplies = context.supplies?.length
      ? context.supplies
      : this.suppliesSignal();
    const grams = Number(dto.grams) || 0;
    const printHours = Number(dto.printTimeHours) || 0;
    const washMinutes = Number(dto.washMinutes) || 0;
    const cureMinutes = Number(dto.cureMinutes) || 0;
    const timeCtx = {
      printTimeHours: printHours,
      washMinutes,
      cureMinutes,
      pressMinutes: 0,
    };

    const resinCost = Math.round(
      this.calcResinCost(dto.brand, dto.resinType, grams, settings),
    );
    const washSupplyCost = Math.round(
      calcWashSupplyCost(settings, supplies, ProductType.RESINA),
    );

    const print = calculateMachineOverheadForRole(
      settings,
      ProductType.RESINA,
      timeCtx,
      MachineProfileRole.PRINT,
    );
    const wash = calculateMachineOverheadForRole(
      settings,
      ProductType.RESINA,
      timeCtx,
      MachineProfileRole.WASH,
    );
    const cure = calculateMachineOverheadForRole(
      settings,
      ProductType.RESINA,
      timeCtx,
      MachineProfileRole.CURE,
    );

    const washProfile = getMachineProfilesForProductType(
      settings,
      ProductType.RESINA,
    ).find((profile) => profile.role === MachineProfileRole.WASH);
    const washSupply = washProfile?.washSupplyId
      ? supplies.find((item) => item.id === washProfile.washSupplyId)
      : undefined;

    return {
      resinCost,
      washSupplyCost,
      washMachineCost: wash.total,
      cureMachineCost: cure.total,
      printCost: print.total,
      printEnergyCost: print.energyCost,
      printMachineCost: print.machineCost,
      washMinutes,
      cureMinutes,
      printHours,
      washSupplyName: washSupply?.name?.trim() || null,
      washConsumptionMl: Math.max(Number(washProfile?.consumptionMl) || 0, 0),
      washBathUses: resolveWashBathUses(washProfile?.washBathUses),
    };
  }

  private calculateMaterialCost(
    dto: CalculateCostPayload,
    settings: GeneralSettings,
    supplies: Supply[],
    impresos: ImpresoWithCost[],
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
      return this.calcFilamentCost(
        dto.brand,
        dto.filamentType,
        grams,
        settings,
      );
    }

    if (dto.type === ProductType.RESINA) {
      return (
        this.calcResinCost(dto.brand, dto.resinType, grams, settings) +
        calcWashSupplyCost(settings, supplies, dto.type)
      );
    }

    if (dto.type === ProductType.ESTAMPADO) {
      return this.calcEstampadoMaterialCost(dto, settings, supplies, impresos);
    }

    return 0;
  }

  private calcEstampadoMaterialCost(
    dto: CalculateCostPayload,
    settings: GeneralSettings,
    supplies: Supply[],
    impresos: ImpresoWithCost[],
  ): number {
    const getImpresoById = (id: string) =>
      impresos.find((item) => item.id === id);

    const prints = normalizeEstampadoPrints(dto.estampadoPrints);

    let paperCost = 0;
    if (prints.length) {
      paperCost = prints.reduce((sum, print) => {
        const dims = resolvePrintDimensions(print, getImpresoById);
        if (!dims) {
          return sum;
        }
        const quantity = Math.max(1, Math.round(Number(print.quantity) || 1));
        return (
          sum +
          this.calculateImpresoPaperCost(
            settings,
            dims.paperType,
            dims.widthCm,
            dims.heightCm,
          ) *
            quantity
        );
      }, 0);
    }

    const supplyCost = normalizeEstampadoSupplies(dto.estampadoSupplies).reduce(
      (sum, line) => {
        const supply = supplies.find((item) => item.id === line.supplyId);
        if (!supply) {
          return sum;
        }
        return sum + Number(supply.unitPrice) * Number(line.quantity);
      },
      0,
    );

    return paperCost + supplyCost;
  }

  private getDefaultFilamentPrice(
    settings: GeneralSettings,
    brand: string | undefined,
    materialType: FilamentType | undefined,
  ): number | null {
    if (!materialType) return null;

    const matches = settings.filamentPrices.filter(
      (entry) => entry.materialType === materialType,
    );
    if (!matches.length) return null;

    if (brand) {
      const exact = matches.find(
        (entry) => entry.brand.toLowerCase() === brand.toLowerCase(),
      );
      if (exact) return exact.pricePerKg;
    }

    const total = matches.reduce((sum, entry) => sum + entry.pricePerKg, 0);
    return total / matches.length;
  }

  private getDefaultResinPrice(
    settings: GeneralSettings,
    brand: string | undefined,
    resinType: ResinType | undefined,
  ): number | null {
    if (!resinType) return null;

    const matches = settings.resinPrices.filter(
      (entry) => entry.resinType === resinType,
    );
    if (!matches.length) return null;

    if (brand) {
      const exact = matches.find(
        (entry) => entry.brand.toLowerCase() === brand.toLowerCase(),
      );
      if (exact) return exact.pricePerLiter;
    }

    const total = matches.reduce((sum, entry) => sum + entry.pricePerLiter, 0);
    return total / matches.length;
  }

  private calcFilamentCost(
    brand: string | undefined,
    materialType: FilamentType | undefined,
    grams: number,
    settings: GeneralSettings,
  ): number {
    const pricePerKg = brand
      ? this.getDefaultFilamentPrice(settings, brand, materialType)
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
      ? this.getDefaultResinPrice(settings, brand, resinType)
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
