import { Injectable } from '@angular/core';
import {
  CreateProductPayload,
  ProductType,
  FilamentType,
  ResinType,
  ProductComponent,
  EstampadoPrintSpec,
  EstampadoPressCycle,
  EstampadoSupplyLine,
  FdmFilamentLine,
  ProductAttachment,
} from '../../../../core/models';
import { storedFdmFilaments, totalFdmFilamentGrams } from '../../../../shared/utils/fdm.helpers';
import { formatEstampadoSizeFromPrints, formatPrintDimensionsCm } from '../../../../shared/utils/estampado.helpers';

export interface ProductPayloadInput {
  type: ProductType;
  name: string;
  isCombo: boolean;
  is3D: boolean;
  isFdm: boolean;
  isResina: boolean;
  isEstampado: boolean;
  usesPieceAssembly: boolean;
  finalPrice: number;
  effectiveCost: number;
  suggestedPrice: number | null;
  categoryIds: string[];
  images: string[];
  attachments: ProductAttachment[];
  published: boolean;
  finishedStock: number;
  components: ProductComponent[];
  assemblyTimeHours: number;
  grams: number;
  totalFilamentGrams: number;
  printTimeHours: number;
  workTimeHours: number;
  filaments: FdmFilamentLine[];
  filamentType: FilamentType;
  filamentLines: FdmFilamentLine[];
  resinType: ResinType | string;
  colorId: string;
  washMinutes: number;
  cureMinutes: number;
  prints: EstampadoPrintSpec[];
  pressCycles: EstampadoPressCycle[];
  supplyLines: EstampadoSupplyLine[];
  sizeWidthCm: number;
  sizeLengthCm: number;
  sizeHeightCm: number;
  impresos: any[];
}

/**
 * Construye el payload de creación/actualización del producto
 * Centraliza la lógica que estaba en `onSubmit()` y `buildPricingInput()`
 */
@Injectable({
  providedIn: 'root',
})
export class ProductPayloadBuilderService {
  /**
   * Construye el tamaño del producto según su tipo
   */
  buildProductSize(
    type: ProductType,
    isCombo: boolean,
    isEstampado: boolean,
    usesPieceAssembly: boolean,
    prints: EstampadoPrintSpec[],
    impresos: any[],
    sizeWidthCm: number,
    sizeLengthCm: number,
    sizeHeightCm: number,
  ): string {
    if (isCombo) {
      return 'Combo';
    }
    if (isEstampado && !usesPieceAssembly) {
      return formatEstampadoSizeFromPrints(prints, impresos);
    }
    const formatted = formatPrintDimensionsCm(
      sizeWidthCm,
      sizeLengthCm || undefined,
      sizeHeightCm,
    );
    return formatted === '—' ? '' : formatted;
  }

  /**
   * Construye el payload completo del producto para guardar
   */
  buildCreatePayload(input: ProductPayloadInput): CreateProductPayload {
    const usesPieceAssembly = this.usesPieceAssembly(input);
    return {
      name: input.name.trim(),
      type: input.type,
      size: this.buildProductSize(
        input.type,
        input.isCombo,
        input.isEstampado,
        usesPieceAssembly,
        input.prints,
        input.impresos,
        input.sizeWidthCm,
        input.sizeLengthCm,
        input.sizeHeightCm,
      ).trim(),
      price: input.finalPrice,
      cost: input.effectiveCost,
      suggestedPrice: input.suggestedPrice,
      categoryIds: input.categoryIds,
      images: input.images,
      attachments: input.attachments,
      published: input.isCombo ? true : input.published,
      stock: Math.max(0, Math.trunc(Number(input.finishedStock) || 0)),
      includesPieces: usesPieceAssembly,
      components: usesPieceAssembly ? input.components : [],
      assemblyTimeHours:
        usesPieceAssembly ? Number(input.assemblyTimeHours) || 0 : 0,
      ...(input.isCombo
        ? {}
        : input.is3D
          ? {
              grams: input.isFdm
                ? input.totalFilamentGrams
                : Number(input.grams) || 0,
              printTimeHours: Number(input.printTimeHours) || 0,
              workTimeHours: Number(input.workTimeHours) || 0,
              filaments: input.isFdm
                ? storedFdmFilaments(input.filamentLines)
                : undefined,
              filamentType:
                input.isFdm && input.filamentLines.length === 1
                  ? input.filamentLines[0]!.filamentType
                  : input.isFdm
                    ? input.filamentType
                    : undefined,
              resinType: input.isResina ? input.resinType : undefined,
              colorId: input.isResina ? input.colorId : undefined,
              washMinutes: input.isResina ? Number(input.washMinutes) || undefined : undefined,
              cureMinutes: input.isResina ? Number(input.cureMinutes) || undefined : undefined,
            }
          : {
              workTimeHours: Number(input.workTimeHours) || 0,
              prints: input.prints,
              pressCycles: input.pressCycles,
              supplies: input.supplyLines,
            }),
    } as CreateProductPayload;
  }

  private usesPieceAssembly(input: ProductPayloadInput): boolean {
    return (
      input.isCombo ||
      input.usesPieceAssembly ||
      input.components.length > 0
    );
  }

  /**
   * Construye el input para calcular precio/costo (reutilizado en múltiples lugares)
   */
  buildPricingInput(
    type: ProductType,
    usesPieceAssembly: boolean,
    components: ProductComponent[],
    assemblyTimeHours: number,
    suggestedPrice: number | null,
    cost: number,
    productCost: number | undefined,
    isCombo: boolean,
    is3D: boolean,
    isFdm: boolean,
    totalFilamentGrams: number,
    grams: number,
    printTimeHours: number,
    workTimeHours: number,
    filamentLines: FdmFilamentLine[],
    filamentType: FilamentType,
    isResina: boolean,
    resinType: ResinType | string,
    colorId: string,
    washMinutes: number,
    cureMinutes: number,
    prints: EstampadoPrintSpec[],
    pressCycles: EstampadoPressCycle[],
    supplyLines: EstampadoSupplyLine[],
  ): any {
    const storedCost = Number(cost) || Number(productCost) || 0;

    return {
      type,
      components: usesPieceAssembly ? components : [],
      assemblyTimeHours: Number(assemblyTimeHours) || 0,
      suggestedPrice,
      cost: usesPieceAssembly ? 0 : storedCost,
      ...(isCombo
        ? {}
        : is3D
          ? {
              grams: isFdm ? totalFilamentGrams : Number(grams) || 0,
              printTimeHours: Number(printTimeHours) || 0,
              workTimeHours: Number(workTimeHours) || 0,
              filaments: isFdm ? storedFdmFilaments(filamentLines) : undefined,
              filamentType:
                isFdm && filamentLines.length === 1
                  ? filamentLines[0]!.filamentType
                  : isFdm
                    ? filamentType
                    : undefined,
              resinType: isResina ? resinType : undefined,
              colorId: isResina ? colorId : undefined,
              washMinutes: isResina ? Number(washMinutes) || undefined : undefined,
              cureMinutes: isResina ? Number(cureMinutes) || undefined : undefined,
            }
          : {
              workTimeHours: Number(workTimeHours) || 0,
              estampadoPrints: prints,
              estampadoPressCycles: pressCycles,
              estampadoSupplies: supplyLines,
            }),
    };
  }
}
