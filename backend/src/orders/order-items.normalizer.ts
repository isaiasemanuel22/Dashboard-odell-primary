import { BadRequestException } from '@nestjs/common';
import { FilamentType, ResinType, ServiceType } from '../common/enums';
import { OrderItem } from '../common/interfaces';
import { isDesignService, normalizeServiceType } from '../common/service-type.util';
import { isDesignPrintConfigured } from './design-print.util';
import {
  isCustomEstampadoOrderLine,
  isEstampadoQuoteConfigured,
} from './order-estampado-quote.util';
import {
  isCustomFdmOrderLine,
  isFdmQuoteConfigured,
  isManualResinOrderLine,
  isResinQuoteConfigured,
  normalizePrintProcess,
} from './order-fdm-quote.util';
import {
  normalizeEstampadoPressCycles,
  normalizeEstampadoPrints,
  normalizeEstampadoSupplies,
} from '../products/estampado-product.util';
import {
  normalizeFdmFilaments,
  totalFdmFilamentGrams,
} from '../products/fdm-product.util';

export interface OrderItemNormalizerDeps {
  resolveOrderUnitPrice: (
    serviceType: ServiceType,
    productId: string | undefined,
    clientUnitPrice: number,
  ) => number;
  findProductById: (productId: string) => { name: string } | null | undefined;
}

function normalizeBudgetedHours(value: unknown): number | undefined {
  const hours = Number(value);
  if (!Number.isFinite(hours) || hours < 0) return undefined;
  return hours;
}

export function normalizeIncomingOrderItems(
  items: OrderItem[],
  deps: OrderItemNormalizerDeps,
): OrderItem[] {
  if (!items?.length) {
    throw new BadRequestException(
      'El pedido debe incluir al menos una línea de trabajo',
    );
  }

  return items.map((item, index) => {
    const serviceType = normalizeServiceType(item.serviceType);
    const productName = item.productName?.trim();
    const quantity = Number(item.quantity);
    const unitPrice = Number(item.unitPrice);
    const productId = item.productId?.trim() || undefined;

    if (!serviceType) {
      throw new BadRequestException(
        `Línea ${index + 1}: servicio inválido`,
      );
    }

    if (!productName) {
      throw new BadRequestException(
        `Línea ${index + 1}: descripción inválida`,
      );
    }

    if (isDesignService(serviceType) && productId) {
      throw new BadRequestException(
        `Línea ${index + 1}: el diseño no debe vincularse a un producto del catálogo`,
      );
    }

    if (
      serviceType === ServiceType.DISENO_GRAFICO &&
      item.includesPrint &&
      !isDesignPrintConfigured(item)
    ) {
      throw new BadRequestException(
        `Línea ${index + 1}: completá tipo de impresión y tamaño (ancho × alto)`,
      );
    }

    if (
      !isDesignService(serviceType) &&
      !productId &&
      !isCustomFdmOrderLine({ serviceType, productId }) &&
      !isCustomEstampadoOrderLine({ serviceType, productId })
    ) {
      throw new BadRequestException(
        `Línea ${index + 1}: producto inválido`,
      );
    }

    if (isCustomFdmOrderLine({ serviceType, productId })) {
      if (isManualResinOrderLine(item)) {
        if (!isResinQuoteConfigured(item)) {
          throw new BadRequestException(
            `Línea ${index + 1}: completá tipo de resina y ml u horas de impresión`,
          );
        }
      } else if (!isFdmQuoteConfigured(item)) {
        throw new BadRequestException(
          `Línea ${index + 1}: completá tipo de filamento y gramos u horas de impresión`,
        );
      }
    }

    if (isCustomEstampadoOrderLine({ serviceType, productId })) {
      if (!isEstampadoQuoteConfigured(item)) {
        throw new BadRequestException(
          `Línea ${index + 1}: completá insumos, impresos/medidas o bajadas de plancha`,
        );
      }
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new BadRequestException(
        `Línea ${index + 1}: cantidad inválida`,
      );
    }

    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      throw new BadRequestException(
        `Línea ${index + 1}: precio unitario inválido`,
      );
    }

    const resolvedUnitPrice = deps.resolveOrderUnitPrice(
      serviceType,
      productId,
      unitPrice,
    );

    let resolvedProductName = productName;
    if (!isDesignService(serviceType) && productId) {
      const product = deps.findProductById(productId);
      if (!product) {
        throw new BadRequestException(
          `Línea ${index + 1}: producto ${productId} no encontrado`,
        );
      }
      resolvedProductName = product.name;
    }

    const fdmFields =
      serviceType === ServiceType.IMPRESION_3D
        ? (() => {
            const printProcess =
              normalizePrintProcess(item.printProcess) ??
              (item.resinType ? 'resina' : undefined);
            const isResin =
              printProcess === 'resina' || !!item.resinType;
            const filaments = isResin
              ? []
              : normalizeFdmFilaments(item.filaments, {
                  grams: item.grams != null ? Number(item.grams) : undefined,
                  filamentType: item.filamentType as FilamentType | undefined,
                }).filter((line) => line.grams > 0);
            const grams =
              filaments.length > 0
                ? totalFdmFilamentGrams(filaments)
                : item.grams != null
                  ? Number(item.grams)
                  : undefined;
            const filamentType = isResin
              ? undefined
              : filaments.find((line) => line.filamentType)?.filamentType ??
                (item.filamentType as FilamentType | undefined);
            const laborNote = item.laborNote?.trim() || undefined;
            const workTimeHours =
              item.workTimeHours != null
                ? Math.max(0, Number(item.workTimeHours) || 0)
                : undefined;
            const resinType = isResin
              ? (item.resinType as ResinType | undefined)
              : undefined;
            return {
              printTimeHours:
                item.printTimeHours != null
                  ? Number(item.printTimeHours)
                  : undefined,
              grams,
              filamentType,
              printProcess: isResin
                ? ('resina' as const)
                : printProcess === 'fdm'
                  ? ('fdm' as const)
                  : filaments.length || filamentType
                    ? ('fdm' as const)
                    : undefined,
              resinType,
              washMinutes: isResin
                ? Math.max(0, Number(item.washMinutes) || 0)
                : undefined,
              cureMinutes: isResin
                ? Math.max(0, Number(item.cureMinutes) || 0)
                : undefined,
              filaments: filaments.length ? filaments : undefined,
              workTimeHours,
              laborNote,
            };
          })()
        : {};

    const estampadoFields =
      serviceType === ServiceType.ESTAMPADO
        ? {
            estampadoPrints: normalizeEstampadoPrints(item.estampadoPrints),
            estampadoPressCycles: normalizeEstampadoPressCycles(
              item.estampadoPressCycles,
            ),
            estampadoSupplies: normalizeEstampadoSupplies(
              item.estampadoSupplies,
            ),
          }
        : {};

    const designFields = isDesignService(serviceType)
      ? {
          designUnitPrice: Number(item.designUnitPrice ?? item.unitPrice),
          budgetedHours: normalizeBudgetedHours(item.budgetedHours),
          chargeMode:
            item.chargeMode === 'hours' || item.chargeMode === 'fixed'
              ? item.chargeMode
              : undefined,
          workKind: item.workKind?.trim() || undefined,
          deliverables: Array.isArray(item.deliverables)
            ? item.deliverables
                .map((entry) => String(entry).trim())
                .filter(Boolean)
            : undefined,
          includesRevisions: item.includesRevisions || undefined,
          needsClientProduct: item.needsClientProduct || undefined,
          linkPrint: item.linkPrint || undefined,
        }
      : {};

    const unitCost =
      item.unitCost != null && Number.isFinite(Number(item.unitCost))
        ? Math.max(0, Number(item.unitCost))
        : undefined;

    return {
      serviceType,
      productId,
      productName: resolvedProductName,
      quantity,
      unitPrice: resolvedUnitPrice,
      unitPriceManual: item.unitPriceManual === true ? true : undefined,
      unitCost,
      ...fdmFields,
      ...estampadoFields,
      ...designFields,
      includesPrint:
        serviceType === ServiceType.DISENO_GRAFICO
          ? (item.includesPrint ?? undefined)
          : undefined,
      printPaperType:
        serviceType === ServiceType.DISENO_GRAFICO
          ? item.printPaperType
          : undefined,
      printWidthCm:
        serviceType === ServiceType.DISENO_GRAFICO
          ? item.printWidthCm
          : undefined,
      printLengthCm:
        serviceType === ServiceType.DISENO_GRAFICO
          ? item.printLengthCm
          : undefined,
      printImpresoId:
        serviceType === ServiceType.DISENO_GRAFICO
          ? item.printImpresoId?.trim() || undefined
          : undefined,
      deliveredQuantity: item.deliveredQuantity ?? 0,
      reservedQuantity: item.reservedQuantity ?? 0,
      productionRequiredQuantity: item.productionRequiredQuantity ?? 0,
      producedQuantity: item.producedQuantity ?? 0,
      deliveredFromProductionQuantity:
        item.deliveredFromProductionQuantity ?? 0,
    };
  });
}
