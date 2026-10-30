import {
  Order,
  OrderItem,
  OrderItemPayload,
  OrderLineDraft,
  OrderStatus,
  Product,
  ProductType,
  ServiceType,
} from '../../core/models';
import { ListFilterOption } from '../../components/db-list-toolbar/db-list-toolbar.component';
import { ORDER_STATUS_LABELS, SERVICE_TYPE_LABELS } from '../constants/labels';
import { labelsToSelectOptions } from './select-options';
import { productPhysicalStock, productStockOverview } from './stock.helpers';
import {
  isDesignPrintConfigured,
  resolveLinePrintUnitPrice,
} from './design-print.util';
import {
  isFdmQuoteConfigured,
  isImpresion3DLine,
  isResinQuoteConfigured,
  isResinQuoteLine,
} from './order-fdm-quote.util';
import {
  isEstampadoLine,
  isEstampadoQuoteConfigured,
} from './order-estampado-quote.util';
import {
  normalizeEstampadoPressCycles,
  normalizeEstampadoPrints,
  normalizeEstampadoSupplies,
} from './estampado.helpers';
import {
  isDesignService,
  isGraphicDesignService,
  normalizeServiceType,
} from './service-type.util';
import {
  normalizeFdmFilaments,
  storedFdmFilaments,
  totalFdmFilamentGrams,
} from './fdm.helpers';

export { isDesignService, isGraphicDesignService };

export const ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.PENDIENTE,
  OrderStatus.EN_PROGRESO,
];

export const FINISHED_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.TERMINADO,
  OrderStatus.PARCIALMENTE_ENTREGADO,
  OrderStatus.ENTREGADO,
];

export const ORDER_DESCRIPTION_MAX_LENGTH = 1_000;

export function isActiveOrder(status: OrderStatus): boolean {
  return ACTIVE_ORDER_STATUSES.includes(status);
}

export function isFinishedOrder(status: OrderStatus): boolean {
  return FINISHED_ORDER_STATUSES.includes(status);
}

export function isClosedOrder(status: OrderStatus): boolean {
  return (
    status === OrderStatus.TERMINADO ||
    status === OrderStatus.PARCIALMENTE_ENTREGADO ||
    status === OrderStatus.ENTREGADO ||
    status === OrderStatus.CANCELADO
  );
}

import {
  calculateTotalWithDiscount,
  calculateDiscountValue,
} from './discount.util';

export function calculateLinePriceTotal(
  line: Pick<
    OrderLineDraft | OrderItem,
    'serviceType' | 'quantity' | 'unitPrice' | 'designUnitPrice' | 'includesPrint'
  > &
    Partial<Pick<OrderLineDraft, 'printUnitPrice'>>,
): number {
  const quantity = Math.max(Math.trunc(Number(line.quantity) || 0), 0);
  if (quantity <= 0) return 0;

  if (isDesignService(line.serviceType)) {
    const designPrice =
      line.designUnitPrice != null
        ? Number(line.designUnitPrice) || 0
        : Number(line.unitPrice) || 0;

    if (line.includesPrint) {
      const printUnitPrice = resolveLinePrintUnitPrice(line);
      return designPrice + quantity * printUnitPrice;
    }

    return designPrice;
  }

  const unitPrice = Number(line.unitPrice) || 0;
  if (unitPrice < 0) return 0;
  return quantity * unitPrice;
}

export function calculateOrderSubtotal(
  items: OrderLineDraft[] | OrderItem[],
): number {
  return items.reduce(
    (sum, item) => sum + calculateLinePriceTotal(item),
    0,
  );
}

export function isLineBillable(line: OrderLineDraft): boolean {
  return calculateLinePriceTotal(line) > 0;
}

export function calculateOrderTotal(
  items: OrderLineDraft[] | OrderItem[],
  discountPercent = 0,
  discountAmount = 0,
): number {
  return calculateTotalWithDiscount(
    calculateOrderSubtotal(items),
    discountPercent,
    discountAmount,
  );
}

export function calculateOrderDiscount(
  items: OrderLineDraft[] | OrderItem[],
  discountPercent = 0,
  discountAmount = 0,
): number {
  return calculateDiscountValue(
    calculateOrderSubtotal(items),
    discountPercent,
    discountAmount,
  );
}

export function serviceTypeFromProduct(product: Product): ServiceType {
  if (product.type === ProductType.ESTAMPADO) {
    return ServiceType.ESTAMPADO;
  }
  return ServiceType.IMPRESION_3D;
}

export function productMatchesServiceType(
  product: Product,
  serviceType: ServiceType,
): boolean {
  if (isDesignService(serviceType)) return false;
  if (serviceType === ServiceType.IMPRESION_3D) {
    return (
      product.type === ProductType.FDM ||
      product.type === ProductType.RESINA ||
      product.type === ProductType.COMBO
    );
  }
  return product.type === ProductType.ESTAMPADO;
}

export function orderLineStockHint(
  line: Pick<OrderLineDraft, 'serviceType' | 'productId' | 'quantity'>,
  product:
    | Pick<
        Product,
        | 'id'
        | 'type'
        | 'includesPieces'
        | 'components'
        | 'stock'
        | 'finishedStock'
        | 'stockOverview'
      >
    | undefined,
  catalog?: Product[],
): string | null {
  if (isDesignService(line.serviceType) || !line.productId || !product) {
    return null;
  }

  const requested = Math.max(Math.trunc(Number(line.quantity) || 0), 0);
  if (requested <= 0) return null;

  const available = product.stockOverview
    ? product.stockOverview.available
    : catalog?.length
      ? productStockOverview(product, undefined, catalog).available
      : productPhysicalStock(product);
  if (requested <= available) return null;

  if (available === 0) {
    return 'Sin stock disponible: al preparar el pedido se creará una tarea de producción.';
  }

  return `Stock insuficiente (${available} disponible): faltan ${requested - available} unidades por producir.`;
}

export function deriveOrderServices(
  lines: Array<{ serviceType: ServiceType }>,
): ServiceType[] {
  return [...new Set(lines.map((line) => line.serviceType))];
}

export function orderIncludesService(
  order: Order,
  service: ServiceType,
): boolean {
  return order.services.includes(service);
}

export function buildOrderItems(
  lines: OrderLineDraft[],
  catalog: Product[],
): OrderItemPayload[] {
  return lines
    .filter((line) => isLineValid(line))
    .map((line) => {
      if (isDesignService(line.serviceType)) {
        const deliverables = (line.deliverables ?? [])
          .map((entry) => entry.trim())
          .filter(Boolean);
        return {
          serviceType: line.serviceType,
          productName: line.customName!.trim(),
          quantity: line.quantity,
          unitPrice: line.includesPrint
            ? resolveLinePrintUnitPrice(line)
            : (line.designUnitPrice ?? line.unitPrice),
          unitPriceManual: line.unitPriceManual || undefined,
          unitCost:
            line.unitCost != null && Number.isFinite(Number(line.unitCost))
              ? Number(line.unitCost)
              : undefined,
          includesPrint: line.includesPrint || undefined,
          printPaperType: line.includesPrint ? line.printPaperType : undefined,
          printWidthCm: line.includesPrint ? line.printWidthCm : undefined,
          printLengthCm: line.includesPrint ? line.printLengthCm : undefined,
          printImpresoId: line.includesPrint ? line.printImpresoId : undefined,
          designUnitPrice: line.designUnitPrice ?? line.unitPrice,
          budgetedHours: line.budgetedHours,
          chargeMode: line.chargeMode,
          workKind: line.workKind?.trim() || undefined,
          deliverables: deliverables.length ? deliverables : undefined,
          includesRevisions: line.includesRevisions || undefined,
          needsClientProduct: line.needsClientProduct || undefined,
          linkPrint: line.linkPrint || undefined,
        };
      }

      const product = catalog.find((p) => p.id === line.productId);
      const isCustomFdm =
        isImpresion3DLine(line.serviceType) && !line.productId?.trim();
      const isCustomEstampado =
        isEstampadoLine(line.serviceType) && !line.productId?.trim();

      const isResinManual =
        isCustomFdm && isResinQuoteLine(line, product);
      const filaments =
        isImpresion3DLine(line.serviceType) && !isResinManual
          ? storedFdmFilaments(line.filaments ?? [])
          : [];
      const grams = isImpresion3DLine(line.serviceType)
        ? filaments.length
          ? totalFdmFilamentGrams(filaments)
          : line.grams
        : undefined;
      const filamentType =
        isImpresion3DLine(line.serviceType) && !isResinManual
          ? filaments.find((row) => row.filamentType)?.filamentType ??
            line.filamentType
          : undefined;
      const laborNote = isImpresion3DLine(line.serviceType)
        ? line.laborNote?.trim() || undefined
        : undefined;

      return {
        serviceType: line.serviceType,
        productId: line.productId?.trim() || undefined,
        productName:
          isCustomFdm || isCustomEstampado
            ? line.customName!.trim()
            : (product?.name ?? line.customName?.trim() ?? 'Producto'),
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        unitPriceManual: line.unitPriceManual || undefined,
        unitCost:
          line.unitCost != null && Number.isFinite(Number(line.unitCost))
            ? Number(line.unitCost)
            : undefined,
        printTimeHours: isImpresion3DLine(line.serviceType)
          ? line.printTimeHours
          : undefined,
        grams,
        filamentType,
        printProcess: isImpresion3DLine(line.serviceType)
          ? isResinManual
            ? 'resina'
            : line.printProcess === 'fdm' || filaments.length || filamentType
              ? 'fdm'
              : line.printProcess
          : undefined,
        resinType: isResinManual ? line.resinType : undefined,
        filaments: filaments.length ? filaments : undefined,
        workTimeHours: isImpresion3DLine(line.serviceType)
          ? line.workTimeHours
          : undefined,
        laborNote,
        estampadoPrints: isEstampadoLine(line.serviceType)
          ? line.estampadoPrints
          : undefined,
        estampadoPressCycles: isEstampadoLine(line.serviceType)
          ? line.estampadoPressCycles
          : undefined,
        estampadoSupplies: isEstampadoLine(line.serviceType)
          ? line.estampadoSupplies
          : undefined,
      };
    });
}

/** Cantidad de línea: entero ≥ 1. */
export function isValidLineQuantity(quantity: unknown): boolean {
  const qty = Number(quantity);
  return Number.isInteger(qty) && qty >= 1;
}

export function lineQuantityError(quantity: unknown): string {
  if (quantity === '' || quantity == null) {
    return 'La cantidad debe ser un entero mayor o igual a 1';
  }
  const qty = Number(quantity);
  if (!Number.isFinite(qty)) {
    return 'La cantidad debe ser un entero mayor o igual a 1';
  }
  if (!Number.isInteger(qty)) {
    return 'La cantidad debe ser un número entero (sin decimales)';
  }
  if (qty < 1) {
    return 'La cantidad debe ser un entero mayor o igual a 1';
  }
  return '';
}

function lineEffectiveUnitPrice(line: OrderLineDraft): number {
  if (isDesignService(line.serviceType)) {
    return Number(line.designUnitPrice ?? line.unitPrice) || 0;
  }
  return Number(line.unitPrice) || 0;
}

export function lineUnitPriceError(line: OrderLineDraft): string {
  const price = lineEffectiveUnitPrice(line);
  if (price < 0) {
    return 'El precio unitario no puede ser negativo';
  }
  if (!(price > 0) && calculateLinePriceTotal(line) <= 0) {
    return 'Indicá un precio unitario mayor a 0';
  }
  return '';
}

export function lineConceptError(line: OrderLineDraft): string {
  if (line.productId?.trim()) return '';
  if (isDesignService(line.serviceType)) {
    return line.customName?.trim() ? '' : 'Indicá un concepto';
  }
  if (isImpresion3DLine(line.serviceType) || isEstampadoLine(line.serviceType)) {
    if (line.customName?.trim()) return '';
    if (isImpresion3DLine(line.serviceType) && isFdmQuoteConfigured(line)) {
      return 'Indicá un concepto';
    }
    if (isEstampadoLine(line.serviceType) && isEstampadoQuoteConfigured(line)) {
      return 'Indicá un concepto';
    }
  }
  return '';
}

/** Primer mensaje de validación de la línea (cantidad, precio, concepto). */
export function lineValidationMessage(line: OrderLineDraft): string {
  return (
    lineQuantityError(line.quantity) ||
    lineUnitPriceError(line) ||
    lineConceptError(line) ||
    ''
  );
}

/**
 * Línea vacía por defecto (se puede ignorar al guardar si hay otras válidas).
 * Cualquier cantidad inválida o precio distinto de 0 la marca como relevante.
 */
export function isLineBlank(line: OrderLineDraft): boolean {
  if (!isValidLineQuantity(line.quantity) || Number(line.quantity) !== 1) {
    return false;
  }
  if (lineEffectiveUnitPrice(line) !== 0) return false;
  if ((Number(line.unitCost) || 0) !== 0) return false;
  if (line.productId?.trim()) return false;
  if (line.customName?.trim()) return false;
  if ((Number(line.budgetedHours) || 0) > 0) return false;
  if ((Number(line.printTimeHours) || 0) > 0) return false;
  if ((Number(line.grams) || 0) > 0) return false;
  if ((Number(line.workTimeHours) || 0) > 0) return false;
  if (line.laborNote?.trim()) return false;
  if (line.workKind?.trim()) return false;
  if (line.deliverables?.length) return false;
  if (line.includesPrint) return false;
  if (line.includesRevisions) return false;
  if (line.needsClientProduct) return false;
  if (line.linkPrint) return false;
  if (line.filaments?.some((f) => (Number(f.grams) || 0) > 0 || !!f.filamentType)) {
    return false;
  }
  if (
    line.estampadoPrints?.some(
      (p) =>
        (Number(p.widthCm) || 0) > 0 ||
        (Number(p.lengthCm) || 0) > 0 ||
        (Number(p.heightCm) || 0) > 0 ||
        (Number(p.quantity) || 0) > 1 ||
        !!p.impresoId,
    )
  ) {
    return false;
  }
  if (
    line.estampadoPressCycles?.some(
      (c) =>
        (Number(c.pressMinutes) || 0) > 0 || (Number(c.bajadas) || 0) > 0,
    )
  ) {
    return false;
  }
  if (
    line.estampadoSupplies?.some(
      (s) => !!s.supplyId || (Number(s.quantity) || 0) > 0,
    )
  ) {
    return false;
  }
  return true;
}

export function isLineValid(line: OrderLineDraft): boolean {
  if (!isValidLineQuantity(line.quantity)) return false;

  const price = lineEffectiveUnitPrice(line);
  if (price < 0) return false;

  if (isDesignService(line.serviceType)) {
    if (!line.customName?.trim()) return false;
    if (line.includesPrint && !isDesignPrintConfigured(line)) return false;
    return calculateLinePriceTotal(line) > 0;
  }

  if (!(price > 0)) return false;

  if (isImpresion3DLine(line.serviceType)) {
    if (line.productId?.trim()) return true;
    if (!line.customName?.trim()) return false;
    if (isResinQuoteLine(line, undefined)) {
      return isResinQuoteConfigured(line);
    }
    return isFdmQuoteConfigured(line);
  }

  if (isEstampadoLine(line.serviceType)) {
    if (line.productId?.trim()) return true;
    return !!line.customName?.trim() && isEstampadoQuoteConfigured(line);
  }

  return !!line.productId?.trim();
}

export function orderLinesFromSaleCart(
  lines: Array<{ productId: string; quantity: number; unitPrice: number }>,
  products: Product[],
): OrderLineDraft[] {
  return lines.map((line) => {
    const product = products.find((item) => item.id === line.productId);
    return {
      serviceType: product
        ? serviceTypeFromProduct(product)
        : ServiceType.IMPRESION_3D,
      productId: line.productId,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
    };
  });
}

export function lineFromOrderItem(item: OrderItem): OrderLineDraft {
  const serviceType =
    normalizeServiceType(item.serviceType) ?? item.serviceType;

  if (isDesignService(serviceType)) {
    const designUnitPrice = item.designUnitPrice ?? item.unitPrice;
    const printUnitPrice = item.includesPrint
      ? resolveLinePrintUnitPrice(item)
      : undefined;
    const deliverables = (item.deliverables ?? [])
      .map((entry) => entry.trim())
      .filter(Boolean);

    return {
      serviceType,
      customName: item.productName,
      quantity: item.quantity,
      unitPrice: item.includesPrint
        ? (printUnitPrice ?? item.unitPrice)
        : designUnitPrice,
      unitPriceManual: item.unitPriceManual || undefined,
      includesPrint: item.includesPrint,
      printPaperType: item.printPaperType,
      printWidthCm: item.printWidthCm,
      printLengthCm: item.printLengthCm,
      printImpresoId: item.printImpresoId,
      designUnitPrice,
      printUnitPrice,
      budgetedHours: item.budgetedHours,
      chargeMode: item.chargeMode,
      workKind: item.workKind,
      deliverables: deliverables.length ? deliverables : undefined,
      includesRevisions: item.includesRevisions || undefined,
      needsClientProduct: item.needsClientProduct || undefined,
      linkPrint: item.linkPrint || undefined,
      unitCost:
        item.unitCost != null && Number.isFinite(Number(item.unitCost))
          ? Number(item.unitCost)
          : undefined,
    };
  }

  const printProcess =
    item.printProcess === 'fdm' || item.printProcess === 'resina'
      ? item.printProcess
      : item.resinType
        ? 'resina'
        : undefined;
  const isResinManual =
    isImpresion3DLine(item.serviceType) &&
    !item.productId &&
    (printProcess === 'resina' || !!item.resinType);

  const filaments =
    isImpresion3DLine(item.serviceType) && !isResinManual
      ? normalizeFdmFilaments(item.filaments, {
          grams: item.grams,
          filamentType: item.filamentType,
        })
      : undefined;

  const estampadoPrints = isEstampadoLine(item.serviceType)
    ? normalizeEstampadoPrints(item.estampadoPrints)
    : undefined;
  const estampadoPressCycles = isEstampadoLine(item.serviceType)
    ? normalizeEstampadoPressCycles(item.estampadoPressCycles)
    : undefined;
  const estampadoSupplies = isEstampadoLine(item.serviceType)
    ? normalizeEstampadoSupplies(item.estampadoSupplies)
    : undefined;

  return {
    serviceType: item.serviceType,
    productId: item.productId,
    // Q2: con producto de catálogo también hay que mostrar el Concepto
    // (antes solo se hidrataba en presupuesto manual).
    customName:
      isImpresion3DLine(item.serviceType) || isEstampadoLine(item.serviceType)
        ? item.productName
        : undefined,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    unitPriceManual: item.unitPriceManual || undefined,
    // Snapshot persistido; si falta, el sync al abrir lo completa.
    unitCost:
      item.unitCost != null && Number.isFinite(Number(item.unitCost))
        ? Number(item.unitCost)
        : undefined,
    printTimeHours: item.printTimeHours,
    grams: item.grams,
    filamentType: isResinManual ? undefined : item.filamentType,
    printProcess: isImpresion3DLine(item.serviceType)
      ? printProcess ?? (item.productId ? undefined : 'fdm')
      : undefined,
    resinType: isResinManual ? item.resinType : undefined,
    filaments: filaments?.length ? filaments : undefined,
    workTimeHours: isImpresion3DLine(item.serviceType)
      ? item.workTimeHours
      : undefined,
    laborNote: isImpresion3DLine(item.serviceType)
      ? item.laborNote
      : undefined,
    estampadoPrints: estampadoPrints?.length ? estampadoPrints : undefined,
    estampadoPressCycles: estampadoPressCycles?.length
      ? estampadoPressCycles
      : undefined,
    estampadoSupplies: estampadoSupplies?.length ? estampadoSupplies : undefined,
  };
}

export function createEmptyLine(serviceType: ServiceType): OrderLineDraft {
  return {
    serviceType,
    uiId: createLineUiId(),
    productId: isDesignService(serviceType) ? undefined : '',
    customName: isDesignService(serviceType) ? '' : undefined,
    quantity: 1,
    unitCost: undefined,
    unitPrice: 0,
    printProcess: isImpresion3DLine(serviceType) ? 'fdm' : undefined,
  };
}

export function ensureLineUiId(line: OrderLineDraft): string {
  if (!line.uiId) {
    line.uiId = createLineUiId();
  }
  return line.uiId;
}

function createLineUiId(): string {
  return `line-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export type OrderStatusFilter = OrderStatus | 'all' | 'abiertos';
export type OrderServiceFilter = ServiceType | 'all';

export function orderStatusFilters(): ListFilterOption<OrderStatusFilter>[] {
  return [
    { value: 'abiertos', label: 'Abiertos' },
    { value: 'all', label: 'Todos' },
    ...labelsToSelectOptions(ORDER_STATUS_LABELS),
  ];
}

export function matchesOrderStatusFilter(
  status: OrderStatus,
  filter: OrderStatusFilter,
): boolean {
  if (filter === 'all') return true;
  if (filter === 'abiertos') return !isClosedOrder(status);
  return status === filter;
}

export function orderServiceFilters(): ListFilterOption<OrderServiceFilter>[] {
  return [
    { value: 'all', label: 'Todos' },
    ...labelsToSelectOptions(SERVICE_TYPE_LABELS),
  ];
}

export function serviceTypeOptions(): { value: ServiceType; label: string }[] {
  return labelsToSelectOptions(SERVICE_TYPE_LABELS);
}

export function orderStatusOptions(): { value: OrderStatus; label: string }[] {
  return labelsToSelectOptions(ORDER_STATUS_LABELS);
}

export const DUE_DATE_AFTER_TODAY_MESSAGE =
  'La fecha de entrega tiene que ser posterior a hoy';

export function defaultDueDate(): string {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return localCalendarDay(date);
}

export function minimumDueDate(reference = new Date()): string {
  const date = new Date(reference);
  date.setDate(date.getDate() + 1);
  return localCalendarDay(date);
}

export function isDueDateAfterToday(
  value: string,
  reference = new Date(),
): boolean {
  const day = value.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  return day > localCalendarDay(reference);
}

function localCalendarDay(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function toDateInputValue(isoDate: string): string {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) {
    return isoDate.slice(0, 10);
  }
  return localCalendarDay(parsed);
}

export function toOrderDueDate(dateValue: string): string {
  return new Date(`${dateValue}T18:00:00.000Z`).toISOString();
}
