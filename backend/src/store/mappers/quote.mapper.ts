import { Prisma } from '@prisma/client';
import { Quote, QuoteItem } from '../../common/interfaces';
import { QuoteStatus } from '../../common/enums';
import { fromJson, toInputJson } from '../../prisma/json.util';
import { normalizeServiceType } from '../../common/service-type.util';

export function mapQuoteItemFromDb(item: {
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
  estampadoPrints?: Prisma.JsonValue;
  estampadoPressCycles?: Prisma.JsonValue;
  estampadoSupplies?: Prisma.JsonValue;
}): QuoteItem {
  return {
    serviceType:
      normalizeServiceType(item.serviceType) ??
      (item.serviceType as QuoteItem['serviceType']),
    productId: item.productId ?? undefined,
    productName: item.productName,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    includesPrint: item.includesPrint ?? undefined,
    printPaperType: (item.printPaperType as QuoteItem['printPaperType']) ?? undefined,
    printWidthCm: item.printWidthCm ?? undefined,
    printLengthCm: item.printLengthCm ?? undefined,
    printImpresoId: item.printImpresoId ?? undefined,
    designUnitPrice: item.designUnitPrice ?? undefined,
    printTimeHours: item.printTimeHours ?? undefined,
    grams: item.grams ?? undefined,
    filamentType: (item.filamentType as QuoteItem['filamentType']) ?? undefined,
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
  return {
    id: `${quoteId}-item-${index}`,
    quoteId,
    sortIndex: index,
    serviceType: item.serviceType,
    productId: item.productId ?? null,
    productName: item.productName,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    includesPrint: item.includesPrint ?? false,
    printPaperType: item.printPaperType ?? null,
    printWidthCm: item.printWidthCm ?? null,
    printLengthCm: item.printLengthCm ?? null,
    printImpresoId: item.printImpresoId ?? null,
    designUnitPrice: item.designUnitPrice ?? null,
    printTimeHours: item.printTimeHours ?? null,
    grams: item.grams ?? null,
    filamentType: item.filamentType ?? null,
    estampadoPrints: toInputJson(item.estampadoPrints ?? []),
    estampadoPressCycles: toInputJson(item.estampadoPressCycles ?? []),
    estampadoSupplies: toInputJson(item.estampadoSupplies ?? []),
  };
}
