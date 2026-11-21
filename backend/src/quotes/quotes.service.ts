import { arTodayKey } from '../common/utils/ar-date.util';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { sanitizeDocumentAttachments } from '../products/product-attachment.util';
import {
  CustomerType,
  PriceType,
  QuoteStatus,
  SalesChannel,
  ServiceType,
} from '../common/enums';
import {
  Customer,
  Order,
  OrderItem,
  Quote,
  QuoteItem,
} from '../common/interfaces';
import { CreateQuoteDto, UpdateQuoteDto } from '../common/dto';
import { isAreaService } from '../common/service-type.util';
import {
  calculateTotalWithDiscount,
  normalizeDiscountFields,
} from '../common/utils/discount.util';
import { calculateOrderItemsSubtotal } from '../orders/order-pricing.util';
import { applyWholesalePricing } from '../orders/wholesale-pricing.util';
import { OrdersService } from '../orders/orders.service';
import { normalizeWholesaleDiscount } from '../settings/wholesale-discount.util';
import {
  CustomerRepository,
  ProductRepository,
  QuoteRepository,
} from '../store/repositories';
import { StoreChangeService } from '../store/store-change.service';
import { StoreService } from '../store/store.service';
import {
  isQuoteLineMissingFromCatalog,
  unpublishedProductFromQuoteLine,
} from './quote-product.util';
import { isQuoteExpired } from './quote-validity.util';
import {
  ORDER_RICH_TEXT_MAX_LENGTH,
  hasRichTextContent,
  plainTextFromHtml,
  sanitizeRichTextHtml,
} from '../orders/rich-text.util';

/** Fecha y marca del pedido que sale del presupuesto (agente de atención, §28.3). */
export interface QuoteOrderOptions {
  dueDate?: string;
  createdByAgent?: boolean;
}

@Injectable()
export class QuotesService {
  constructor(
    private readonly quotes: QuoteRepository,
    private readonly customers: CustomerRepository,
    private readonly orders: OrdersService,
    private readonly products: ProductRepository,
    private readonly store: StoreService,
    private readonly storeChange: StoreChangeService,
  ) {}

  findAll(): Quote[] {
    return [...this.quotes.findAll()].sort((a, b) => {
      const byQuoted =
        new Date(b.quotedAt).getTime() - new Date(a.quotedAt).getTime();
      if (byQuoted !== 0) return byQuoted;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  findOne(id: string): Quote {
    const quote = this.quotes.findById(id);
    if (!quote) {
      throw new NotFoundException(`Presupuesto ${id} no encontrado`);
    }
    return quote;
  }

  /** Precio de las líneas y total como los calcula `create`, sin guardar. */
  previewPricing(data: CreateQuoteDto): {
    items: QuoteItem[];
    total: number;
    priceType: PriceType;
    wholesaleApplied: boolean;
  } {
    const { customer } = this.resolveCustomer(data.customerId);
    const priceType =
      data.priceType ?? this.defaultPriceTypeForCustomer(customer);
    const normalizedItems = this.normalizeItemsForStatus(data.items);
    const priced = this.priceQuoteItems(normalizedItems, priceType, customer);
    const total = this.calculateTotal(
      priced.items,
      normalizeDiscountFields(data),
    );
    return {
      items: priced.items,
      total,
      priceType,
      wholesaleApplied: priced.wholesaleApplied,
    };
  }

  create(data: CreateQuoteDto): Quote {
    const { customerId, customerName } = this.resolveCustomer(data.customerId);
    const status = this.resolveFormStatus(data.status);
    const description = this.normalizeDescription(data.description);
    const { items, total, priceType, wholesaleApplied } =
      this.previewPricing(data);
    const services = this.deriveServices(items);
    const discount = normalizeDiscountFields(data);
    const now = new Date();
    const quotedAt = this.todayQuotedAt(now);
    this.assertCustomerForSent(status, customerId);
    this.assertItemsForSent(status, items);
    this.assertDraftHasContent(status, customerId, description);
    const lossFields = this.orders.resolveLossReasonFields(items, total, data);

    const quote: Quote = {
      id: this.quotes.nextId(),
      createdAt: now.toISOString(),
      quotedAt,
      customerId,
      customerName,
      services,
      items,
      status,
      priceType,
      wholesaleApplied,
      salesChannel: this.normalizeSalesChannel(data.salesChannel),
      total,
      discountPercent: discount.discountPercent,
      discountAmount: discount.discountAmount,
      lossReason: lossFields.lossReason,
      lossReasonNote: lossFields.lossReasonNote,
      description,
      attachments: sanitizeDocumentAttachments(data.attachments),
    };

    return this.quotes.create(quote);
  }

  update(id: string, data: UpdateQuoteDto): Quote {
    const current = this.findOne(id);
    this.assertEditable(current);

    let customerId = current.customerId;
    let customerName = current.customerName;
    let customer: Customer | undefined;

    if (data.customerId !== undefined) {
      const resolved = this.resolveCustomer(data.customerId);
      customerId = resolved.customerId;
      customerName = resolved.customerName;
      customer = resolved.customer;
    }

    const priceType = data.priceType ?? current.priceType ?? PriceType.LISTA;
    const shouldReprice =
      data.priceType !== undefined ||
      data.customerId !== undefined ||
      data.items !== undefined;

    const status =
      data.status !== undefined
        ? this.resolveFormStatus(data.status)
        : current.status;
    const description =
      data.description !== undefined
        ? this.normalizeDescription(data.description)
        : current.description;

    let items =
      data.items !== undefined
        ? this.normalizeItemsForStatus(data.items)
        : current.items;
    let wholesaleApplied = current.wholesaleApplied === true;

    if (shouldReprice) {
      const priced = this.priceQuoteItems(
        items,
        priceType,
        customer ?? (customerId ? this.customers.findById(customerId) : null),
      );
      items = priced.items;
      wholesaleApplied = priced.wholesaleApplied;
    }

    const services =
      data.items !== undefined ? this.deriveServices(items) : current.services;

    const discount = normalizeDiscountFields({
      discountPercent:
        data.discountPercent !== undefined
          ? data.discountPercent
          : current.discountPercent,
      discountAmount:
        data.discountAmount !== undefined
          ? data.discountAmount
          : current.discountAmount,
    });

    this.assertCustomerForSent(status, customerId);
    this.assertItemsForSent(status, items);
    this.assertDraftHasContent(status, customerId, description);

    const salesChannel =
      data.salesChannel !== undefined
        ? this.normalizeSalesChannel(data.salesChannel)
        : current.salesChannel;

    const total = this.calculateTotal(items, discount);
    // El motivo se exige al tocar precios, líneas o descuento (o al mandarlo).
    const pricingTouched =
      data.items !== undefined ||
      data.discountPercent !== undefined ||
      data.discountAmount !== undefined ||
      data.priceType !== undefined ||
      data.lossReason !== undefined;
    const lossFields = pricingTouched
      ? this.orders.resolveLossReasonFields(items, total, {
          lossReason: data.lossReason ?? current.lossReason,
          lossReasonNote:
            data.lossReason !== undefined
              ? data.lossReasonNote
              : (data.lossReasonNote ?? current.lossReasonNote),
        })
      : {
          lossReason: current.lossReason,
          lossReasonNote: current.lossReasonNote,
        };

    const updated: Quote = {
      ...current,
      customerId,
      customerName,
      services,
      items,
      priceType,
      wholesaleApplied,
      salesChannel,
      total,
      discountPercent: discount.discountPercent,
      discountAmount: discount.discountAmount,
      lossReason: lossFields.lossReason,
      lossReasonNote: lossFields.lossReasonNote,
      description,
      attachments:
        data.attachments !== undefined
          ? sanitizeDocumentAttachments(data.attachments)
          : (current.attachments ?? []),
      status,
    };

    return this.quotes.save(updated);
  }

  updateStatus(
    id: string,
    status: QuoteStatus,
    actorUserId?: string,
    orderOptions?: QuoteOrderOptions,
  ): Quote {
    const quote = this.findOne(id);
    if (quote.status === status) {
      return quote;
    }

    if (
      quote.status === QuoteStatus.ACEPTADO ||
      quote.status === QuoteStatus.RECHAZADO ||
      quote.status === QuoteStatus.CANCELADO
    ) {
      throw new BadRequestException(
        'No se puede cambiar el estado de un presupuesto cerrado',
      );
    }

    if (status === QuoteStatus.ACEPTADO && isQuoteExpired(quote)) {
      throw new BadRequestException(
        'El presupuesto está vencido: renovalo para extender la validez antes de aceptarlo',
      );
    }
    if (status === QuoteStatus.ACEPTADO && !quote.customerId) {
      throw new BadRequestException('El pedido requiere un cliente asociado');
    }
    this.assertCustomerForSent(status, quote.customerId);
    if (status === QuoteStatus.ENVIADO || status === QuoteStatus.ACEPTADO) {
      this.assertItemsForSent(QuoteStatus.ENVIADO, quote.items);
    }

    const previousStatus = quote.status;
    quote.status = status;
    this.quotes.save(quote);
    if (status === QuoteStatus.ACEPTADO && !quote.orderId) {
      try {
        this.createOrderFromQuote(quote.id, actorUserId, orderOptions);
      } catch (error) {
        // Si el pedido no se pudo crear, el presupuesto no queda aceptado.
        const current = this.quotes.findById(id);
        if (current) this.quotes.save({ ...current, status: previousStatus });
        throw error;
      }
    }
    return this.findOne(id);
  }

  /** Extiende la validez: la fecha de emisión pasa a hoy (validez = emisión + 15 días). */
  renew(id: string): Quote {
    const quote = this.findOne(id);
    this.assertEditable(quote);
    return this.quotes.save({ ...quote, quotedAt: this.todayQuotedAt() });
  }

  remove(id: string): void {
    const quote = this.findOne(id);
    if (quote.status === QuoteStatus.ACEPTADO) {
      throw new BadRequestException(
        'No se puede eliminar un presupuesto aceptado',
      );
    }

    const removed = this.quotes.remove(id);
    if (!removed) {
      throw new NotFoundException(`Presupuesto ${id} no encontrado`);
    }
  }

  createOrderFromQuote(
    id: string,
    actorUserId?: string,
    orderOptions: QuoteOrderOptions = {},
  ): Order {
    const quote = this.findOne(id);

    if (quote.status !== QuoteStatus.ACEPTADO) {
      throw new BadRequestException(
        'Solo se puede generar un pedido desde un presupuesto aceptado',
      );
    }

    if (!quote.customerId) {
      throw new BadRequestException('El pedido requiere un cliente asociado');
    }

    if (quote.orderId) {
      try {
        return this.orders.findOne(quote.orderId);
      } catch {
        quote.orderId = undefined;
      }
    }

    const createdProductIds: string[] = [];
    let items: QuoteItem[];
    let order: Order;
    try {
      items = this.attachCatalogProducts(quote.items, createdProductIds);
      order = this.createOrderFromQuoteItems(
        quote,
        items,
        actorUserId,
        orderOptions,
      );
    } catch (error) {
      // No dejar productos huérfanos si el pedido no se pudo crear.
      for (const productId of createdProductIds) {
        this.products.remove(productId);
      }
      throw error;
    }
    this.quotes.save({ ...quote, items, orderId: order.id });
    this.storeChange.recordChange({
      collections: ['quotes', 'orders', 'printJobs', 'products'],
      realtime: {
        scopes: ['quotes', 'orders', 'print-jobs', 'products', 'dashboard'],
        action: 'create',
        entity: 'order',
        id: order.id,
      },
    });
    return order;
  }

  private createOrderFromQuoteItems(
    quote: Quote,
    items: QuoteItem[],
    actorUserId?: string,
    orderOptions: QuoteOrderOptions = {},
  ): Order {
    // Copia priceType, canal y precios cotizados sin recalcularlos (§16.2).
    return this.orders.create(
      {
        customerId: quote.customerId ?? undefined,
        items: items,
        priceType: quote.priceType ?? PriceType.LISTA,
        salesChannel: quote.salesChannel,
        discountPercent: quote.discountPercent,
        discountAmount: quote.discountAmount,
        lossReason: quote.lossReason,
        lossReasonNote: quote.lossReasonNote,
        description: quote.description,
        attachments: quote.attachments?.length
          ? quote.attachments.map((item) => ({ ...item }))
          : undefined,
        dueDate: orderOptions.dueDate ?? this.defaultOrderDueDate(),
        responsibleUserId: actorUserId?.trim() || undefined,
      },
      {
        keepQuotedPrices: { wholesaleApplied: quote.wholesaleApplied === true },
        createdByAgent: orderOptions.createdByAgent,
      },
    );
  }

  private attachCatalogProducts(
    items: QuoteItem[],
    createdProductIds: string[] = [],
  ): QuoteItem[] {
    return items.map((item) => {
      if (
        !isQuoteLineMissingFromCatalog(item, (productId) =>
          Boolean(this.products.findById(productId)),
        )
      ) {
        return item;
      }

      const name = item.productName?.trim();
      if (!name) {
        throw new BadRequestException('El producto nuevo necesita un nombre');
      }

      const product = unpublishedProductFromQuoteLine(
        { ...item, productName: name },
        this.store.nextId('prod', this.store.products),
        new Date().toISOString(),
      );
      if (!product) return item;

      this.products.create(product);
      createdProductIds.push(product.id);
      return {
        ...item,
        productId: product.id,
        productName: product.name,
      };
    });
  }

  private normalizeQuoteItems(items: OrderItem[]): QuoteItem[] {
    return this.toQuoteItems(this.orders.normalizeOrderItems(items));
  }

  private assertEditable(quote: Quote): void {
    if (
      quote.status === QuoteStatus.ACEPTADO ||
      quote.status === QuoteStatus.RECHAZADO ||
      quote.status === QuoteStatus.CANCELADO
    ) {
      throw new BadRequestException(
        'Este presupuesto ya no se puede modificar',
      );
    }
  }

  /** Desde el formulario solo se aceptan borrador o enviado. */
  private resolveFormStatus(status?: QuoteStatus): QuoteStatus {
    if (status === QuoteStatus.ENVIADO) return QuoteStatus.ENVIADO;
    return QuoteStatus.BORRADOR;
  }

  /** Enviado exige cliente; borrador puede ir «Sin cliente». */
  private assertCustomerForSent(
    status: QuoteStatus,
    customerId: string | null | undefined,
  ): void {
    if (status !== QuoteStatus.ENVIADO) return;
    if (customerId?.trim()) return;
    throw new BadRequestException(
      'Para dejar el presupuesto Enviado necesitás un cliente',
    );
  }

  /** Enviado (y Aceptado) exige al menos una línea. */
  private assertItemsForSent(
    status: QuoteStatus,
    items: QuoteItem[] | undefined,
  ): void {
    if (status !== QuoteStatus.ENVIADO) return;
    if (items && items.length > 0) return;
    throw new BadRequestException(
      'El presupuesto necesita al menos una línea para enviarse',
    );
  }

  /** Un borrador puede no tener líneas, pero sí cliente o descripción. */
  private assertDraftHasContent(
    status: QuoteStatus,
    customerId: string | null | undefined,
    description: string | undefined,
  ): void {
    if (status !== QuoteStatus.BORRADOR) return;
    if (customerId?.trim() || description) return;
    throw new BadRequestException(
      'El borrador necesita al menos un cliente o una descripción',
    );
  }

  /**
   * Sin líneas no pasa por el normalizer (que las exige en pedidos): el
   * borrador queda vacío y Enviado lo rechaza `assertItemsForSent`.
   */
  private normalizeItemsForStatus(items: OrderItem[] | undefined): QuoteItem[] {
    if (!(items && items.length > 0)) return [];
    return this.normalizeQuoteItems(items ?? []);
  }

  private deriveServices(items: QuoteItem[]): ServiceType[] {
    return [
      ...new Set(
        items
          .map((item) => item.serviceType)
          .filter((serviceType) => isAreaService(serviceType)),
      ),
    ];
  }

  private toQuoteItems(items: OrderItem[]): QuoteItem[] {
    return items.map(
      ({
        deliveredQuantity: _deliveredQuantity,
        reservedQuantity: _reservedQuantity,
        productionRequiredQuantity: _productionRequiredQuantity,
        producedQuantity: _producedQuantity,
        deliveredFromProductionQuantity: _deliveredFromProductionQuantity,
        ...item
      }) => item,
    );
  }

  private calculateTotal(
    items: QuoteItem[],
    discount: ReturnType<typeof normalizeDiscountFields>,
  ): number {
    const subtotal = calculateOrderItemsSubtotal(items);
    return calculateTotalWithDiscount(subtotal, discount);
  }

  private todayQuotedAt(reference = new Date()): string {
    const [year, month, day] = arTodayKey(reference).split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).toISOString();
  }

  private normalizeDescription(description?: string): string | undefined {
    const sanitized = sanitizeRichTextHtml(description);
    if (!hasRichTextContent(sanitized)) return undefined;

    const plainLength = plainTextFromHtml(sanitized).length;
    if (plainLength > ORDER_RICH_TEXT_MAX_LENGTH) {
      throw new BadRequestException(
        `La descripción no puede superar los ${ORDER_RICH_TEXT_MAX_LENGTH} caracteres`,
      );
    }

    return sanitized;
  }

  private defaultOrderDueDate(reference = new Date()): string {
    const date = new Date(reference);
    date.setDate(date.getDate() + 7);
    const dateValue = date.toISOString().slice(0, 10);
    return new Date(`${dateValue}T18:00:00.000Z`).toISOString();
  }

  private resolveCustomer(customerId?: string | null): {
    customerId: string | null;
    customerName: string;
    customer?: Customer;
  } {
    const trimmed = customerId?.trim();
    if (!trimmed) {
      return { customerId: null, customerName: 'Sin cliente' };
    }

    const customer = this.customers.findById(trimmed);
    if (!customer) {
      throw new BadRequestException('Cliente no válido');
    }

    return {
      customerId: customer.id,
      customerName: customer.name,
      customer,
    };
  }

  private defaultPriceTypeForCustomer(customer?: Customer | null): PriceType {
    return customer?.type === CustomerType.REVENDEDOR
      ? PriceType.MAYORISTA
      : PriceType.LISTA;
  }

  private normalizeSalesChannel(
    value?: SalesChannel | null,
  ): SalesChannel | undefined {
    if (value == null) return undefined;
    return value;
  }

  private priceQuoteItems(
    items: QuoteItem[],
    priceType: PriceType,
    customer?: Customer | null,
  ): { items: QuoteItem[]; wholesaleApplied: boolean } {
    const settings = normalizeWholesaleDiscount(
      this.store.generalSettings.wholesaleDiscount,
    );
    return applyWholesalePricing(items, {
      priceType,
      customer: customer ?? null,
      settings,
      resolveUnitCost: (item) => this.orders.resolveItemUnitCost(item),
    });
  }
}
