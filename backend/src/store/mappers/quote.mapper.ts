import { Prisma } from '@prisma/client';
import { FdmFilamentLine, Quote, QuoteItem } from '../../common/interfaces';
import { QuoteStatus } from '../../common/enums';
import { fromJson, toInputJson } from '../../prisma/json.util';
import { normalizeServiceType } from '../../common/service-type.util';
import { normalizeFdmFilaments } from '../../products/fdm-product.util';
import { persistedFdmLine } from '../brand-link.util';

export function mapQuoteItemFromDb(item: {
  serviceType: string;
  productId: string | null;
  productName: string;
  quantity: number;
  unitPrice: number;
  unitPriceManual?: boolean;
  unitCost?: number | null;
  includesPrint?: boolean;
  printPaperType?: string | null;
  printWidthCm?: number | null;
  printLengthCm?: number | null;
  printImpresoId?: string | null;
  designUnitPrice?: number | null;
  printTimeHours?: number | null;
  grams?: number | null;
  filamentType?: string | null;
  printProcess?: string | null;
  resinType?: string | null;
  workTimeHours?: number | null;
  laborNote?: string | null;
  fdmFilaments?: Prisma.JsonValue;
  budgetedHours?: number | null;
  chargeMode?: string | null;
  workKind?: string | null;
  deliverables?: Prisma.JsonValue;
  includesRevisions?: boolean;
  needsClientProduct?: boolean;
  linkPrint?: boolean;
  estampadoPrints?: Prisma.JsonValue;
  estampadoPressCycles?: Prisma.JsonValue;
  estampadoSupplies?: Prisma.JsonValue;
}): QuoteItem {
  const filaments = normalizeFdmFilaments(
    fromJson<FdmFilamentLine[]>(item.fdmFilaments ?? []),
    {
      grams: item.grams ?? undefined,
      filamentType: item.filamentType as QuoteItem['filamentType'],
    },
  );
  const deliverables = fromJson<string[]>(item.deliverables ?? []);
  const chargeMode =
    item.chargeMode === 'hours' || item.chargeMode === 'fixed'
      ? item.chargeMode
      : undefined;

  return {
    serviceType:
      normalizeServiceType(item.serviceType) ??
      (item.serviceType as QuoteItem['serviceType']),
    productId: item.productId ?? undefined,
    productName: item.productName,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    unitPriceManual: item.unitPriceManual || undefined,
    unitCost:
      item.unitCost != null && Number.isFinite(Number(item.unitCost))
        ? Number(item.unitCost)
        : undefined,
    includesPrint: item.includesPrint ?? undefined,
    printPaperType: (item.printPaperType as QuoteItem['printPaperType']) ?? undefined,
    printWidthCm: item.printWidthCm ?? undefined,
    printLengthCm: item.printLengthCm ?? undefined,
    printImpresoId: item.printImpresoId ?? undefined,
    designUnitPrice: item.designUnitPrice ?? undefined,
    printTimeHours: item.printTimeHours ?? undefined,
    grams: item.grams ?? undefined,
    filamentType: (item.filamentType as QuoteItem['filamentType']) ?? undefined,
    printProcess:
      item.printProcess === 'fdm' || item.printProcess === 'resina'
        ? item.printProcess
        : undefined,
    resinType: (item.resinType as QuoteItem['resinType']) ?? undefined,
    filaments: filaments.length ? filaments : undefined,
    workTimeHours: item.workTimeHours ?? undefined,
    laborNote: item.laborNote?.trim() || undefined,
    budgetedHours: item.budgetedHours ?? undefined,
    chargeMode,
    workKind: item.workKind?.trim() || undefined,
    deliverables: deliverables.length ? deliverables : undefined,
    includesRevisions: item.includesRevisions || undefined,
    needsClientProduct: item.needsClientProduct || undefined,
    linkPrint: item.linkPrint || undefined,
    estampadoPrints: fromJson<QuoteItem['estampadoPrints']>(
      item.estampadoPrints ?? [],
    ),
    estampadoPressCycles: fromJson<QuoteItem['estampadoPressCycles']>(
      item.estampadoPressCycles ?? [],
    ),
    estampadoSupplies: fromJson<QuoteItem['estampadoSupplies']>(
      item.estampadoSupplies ?? [],
    ),
  };
}

export function mapQuoteFromDb(row: {
  id: string;
  customerId: string | null;
  customerName: string;
  services: Prisma.JsonValue;
  status: string;
  total: number;
  discountPercent?: number;
  discountAmount?: number;
  description?: string | null;
  quotedAt: Date;
  createdAt: Date;
  orderId?: string | null;
  items: Array<{
    serviceType: string;
    productId: string | null;
    productName: string;
    quantity: number;
    unitPrice: number;
    includesPrint?: boolean;
    printPaperType?: string | null;
    printWidthCm?: number | null;
    printLengthCm?: number | null;
    printImpresoId?: string | null;
    designUnitPrice?: number | null;
    printTimeHours?: number | null;
    grams?: number | null;
    filamentType?: string | null;
  }>;
}): Quote {
  return {
    id: row.id,
    customerId: row.customerId,
    customerName: row.customerName,
    services: fromJson<Quote['services']>(row.services),
    items: row.items.map((item) => mapQuoteItemFromDb(item)),
    status: row.status as QuoteStatus,
    total: row.total,
    discountPercent: row.discountPercent ?? 0,
    discountAmount: row.discountAmount ?? 0,
    description: row.description ?? undefined,
    quotedAt: row.quotedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    orderId: row.orderId ?? undefined,
  };
}

function mapQuoteScalarsToDb(quote: Quote) {
  return {
    customerId: quote.customerId,
    customerName: quote.customerName,
    services: toInputJson(quote.services),
    status: quote.status,
    total: quote.total,
    discountPercent: quote.discountPercent ?? 0,
    discountAmount: quote.discountAmount ?? 0,
    description: quote.description ?? null,
    quotedAt: new Date(quote.quotedAt),
    createdAt: new Date(quote.createdAt),
    orderId: quote.orderId ?? null,
  };
}

export function mapQuoteToDbCreate(
  quote: Quote,
): Prisma.QuoteUncheckedCreateInput {
  return {
    id: quote.id,
    ...mapQuoteScalarsToDb(quote),
  };
}

export function mapQuoteToDbUpdate(
  quote: Quote,
): Prisma.QuoteUncheckedUpdateInput {
  return mapQuoteScalarsToDb(quote);
}

export function mapQuoteItemToDb(
  quoteId: string,
  index: number,
  item: QuoteItem,
) {
  const filaments = normalizeFdmFilaments(item.filaments, {
    grams: item.grams,
    filamentType: item.filamentType,
  }).filter((line) => line.grams > 0);

  return {
    id: `${quoteId}-item-${index}`,
    quoteId,
    sortIndex: index,
    serviceType: item.serviceType,
    productId: item.productId ?? null,
    productName: item.productName,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    unitPriceManual: item.unitPriceManual === true,
    unitCost:
      item.unitCost != null && Number.isFinite(Number(item.unitCost))
        ? Number(item.unitCost)
        : null,
    includesPrint: item.includesPrint ?? false,
    printPaperType: item.printPaperType ?? null,
    printWidthCm: item.printWidthCm ?? null,
    printLengthCm: item.printLengthCm ?? null,
    printImpresoId: item.printImpresoId ?? null,
    designUnitPrice: item.designUnitPrice ?? null,
    printTimeHours: item.printTimeHours ?? null,
    grams: item.grams ?? null,
    filamentType: item.filamentType ?? null,
    printProcess: item.printProcess ?? null,
    resinType: item.resinType ?? null,
    workTimeHours: item.workTimeHours ?? null,
    laborNote: item.laborNote?.trim() || null,
    fdmFilaments: toInputJson(filaments.map(persistedFdmLine)),
    budgetedHours: item.budgetedHours ?? null,
    chargeMode: item.chargeMode ?? null,
    workKind: item.workKind?.trim() || null,
    deliverables: toInputJson(item.deliverables ?? []),
    includesRevisions: item.includesRevisions ?? false,
    needsClientProduct: item.needsClientProduct ?? false,
    linkPrint: item.linkPrint ?? false,
    estampadoPrints: toInputJson(item.estampadoPrints ?? []),
    estampadoPressCycles: toInputJson(item.estampadoPressCycles ?? []),
    estampadoSupplies: toInputJson(item.estampadoSupplies ?? []),
  };
}
