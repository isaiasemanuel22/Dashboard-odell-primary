import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { QuoteStatus, ServiceType } from '../common/enums';
import { Order, OrderItem, Quote, QuoteItem } from '../common/interfaces';
import { CreateQuoteDto, UpdateQuoteDto } from '../common/dto';
import {
  calculateTotalWithDiscount,
  normalizeDiscountFields,
} from '../common/utils/discount.util';
import { calculateOrderItemsSubtotal } from '../orders/order-pricing.util';
import { OrdersService } from '../orders/orders.service';
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
import {
  ORDER_RICH_TEXT_MAX_LENGTH,
  hasRichTextContent,
  plainTextFromHtml,
  sanitizeRichTextHtml,
} from '../orders/rich-text.util';

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

  create(data: CreateQuoteDto): Quote {
    const { customerId, customerName } = this.resolveCustomer(data.customerId);
    const items = this.normalizeQuoteItems(data.items);
    const services = this.deriveServices(items);
    const discount = normalizeDiscountFields(data);
    const now = new Date();
    const quotedAt = this.todayQuotedAt(now);

    const quote: Quote = {
      id: this.quotes.nextId(),
      createdAt: now.toISOString(),
      quotedAt,
      customerId,
      customerName,
      services,
      items,
      status: QuoteStatus.BORRADOR,
      total: this.calculateTotal(items, discount),
      discountPercent: discount.discountPercent,
      discountAmount: discount.discountAmount,
      description: this.normalizeDescription(data.description),
    };

    return this.quotes.create(quote);
  }

  update(id: string, data: UpdateQuoteDto): Quote {
    const current = this.findOne(id);
    this.assertEditable(current);

    let customerId = current.customerId;
    let customerName = current.customerName;

    if (data.customerId !== undefined) {
      const resolved = this.resolveCustomer(data.customerId);
      customerId = resolved.customerId;
      customerName = resolved.customerName;
    }

    const items =
      data.items !== undefined
        ? this.normalizeQuoteItems(data.items)
        : current.items;
    const services =
      data.items !== undefined
        ? this.deriveServices(items)
        : current.services;

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

    const updated: Quote = {
      ...current,
      customerId,
      customerName,
      services,
      items,
      total: this.calculateTotal(items, discount),
      discountPercent: discount.discountPercent,
      discountAmount: discount.discountAmount,
      description:
        data.description !== undefined
          ? this.normalizeDescription(data.description)
          : current.description,
    };

    return this.quotes.save(updated);
  }

  updateStatus(id: string, status: QuoteStatus): Quote {
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

    if (status === QuoteStatus.ACEPTADO && !quote.customerId) {
      throw new BadRequestException('El pedido requiere un cliente asociado');
    }

    quote.status = status;
    this.quotes.save(quote);
    if (status === QuoteStatus.ACEPTADO && !quote.orderId) {
      this.createOrderFromQuote(quote.id);
    }
    return this.findOne(id);
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

  createOrderFromQuote(id: string): Order {
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

    const items = this.attachCatalogProducts(quote.items);
    const order = this.orders.create({
      customerId: quote.customerId ?? undefined,
      items: items as OrderItem[],
      discountPercent: quote.discountPercent,
      discountAmount: quote.discountAmount,
      description: quote.description,
      dueDate: this.defaultOrderDueDate(),
    });

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

  private attachCatalogProducts(items: QuoteItem[]): QuoteItem[] {
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

  private deriveServices(items: QuoteItem[]): ServiceType[] {
    const services = [...new Set(items.map((item) => item.serviceType))];
    if (!services.length) {
      throw new BadRequestException(
        'El presupuesto debe incluir al menos un servicio',
      );
    }
    return services;
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
    return new Date(
      Date.UTC(
        reference.getFullYear(),
        reference.getMonth(),
        reference.getDate(),
        12,
        0,
        0,
      ),
    ).toISOString();
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
  } {
    const trimmed = customerId?.trim();
    if (!trimmed) {
      return { customerId: null, customerName: 'Sin cliente' };
    }

    const customer = this.customers.findById(trimmed);
    if (!customer) {
      throw new BadRequestException('Cliente no válido');
    }

    return { customerId: customer.id, customerName: customer.name };
  }
}
