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
import { CustomerRepository, QuoteRepository } from '../store/repositories';

@Injectable()
export class QuotesService {
  constructor(
    private readonly quotes: QuoteRepository,
    private readonly customers: CustomerRepository,
    private readonly orders: OrdersService,
  ) {}

  findAll(): Quote[] {
    return [...this.quotes.findAll()].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
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

    quote.status = status;
    return this.quotes.save(quote);
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

    if (quote.orderId) {
      try {
        return this.orders.findOne(quote.orderId);
      } catch {
        quote.orderId = undefined;
      }
    }

    const order = this.orders.create({
      customerId: quote.customerId ?? undefined,
      items: quote.items as OrderItem[],
      discountPercent: quote.discountPercent,
      discountAmount: quote.discountAmount,
      dueDate: this.defaultOrderDueDate(),
    });

    this.quotes.save({ ...quote, orderId: order.id });
    return order;
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
