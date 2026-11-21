import { BadRequestException, Injectable } from '@nestjs/common';
import { AgentApprovalsService } from '../agent-approvals/agent-approvals.service';
import { formatMoney } from '../alerts/alerts.util';
import { ApiKeyPrincipal } from '../api-keys/api-key-scopes';
import { OrderStatus, PaymentMethod } from '../common/enums';
import { outstandingCents, toCents } from '../common/utils/money.util';
import { productSalePrice } from '../common/utils/product-discount.util';
import { OrdersService } from '../orders/orders.service';
import { PrinterQueueService } from '../print-jobs/printer-queue.service';
import { buildProductStockOverview } from '../products/product-stock.util';
import { QuotesService } from '../quotes/quotes.service';
import { StoreChangeService } from '../store/store-change.service';
import { StoreService } from '../store/store.service';
import { catalogLine, findPublishedProduct } from './catalog-line.util';

const PENDING_APPROVAL = 'pendiente de aprobación';

/** Lógica de las herramientas del servidor MCP (§28.4), sin el SDK. */
@Injectable()
export class McpToolsService {
  constructor(
    private readonly store: StoreService,
    private readonly quotes: QuotesService,
    private readonly orders: OrdersService,
    private readonly printerQueue: PrinterQueueService,
    private readonly approvals: AgentApprovalsService,
    private readonly storeChange: StoreChangeService,
  ) {}

  consultarStock(input: { query?: string; productId?: string }) {
    const term = input.query?.trim().toLowerCase();
    return this.store.products
      .filter((product) => product.published !== false)
      .filter((product) => !input.productId || product.id === input.productId)
      .filter((product) => !term || product.name.toLowerCase().includes(term))
      .map((product) => ({
        productId: product.id,
        name: product.name,
        price: productSalePrice(product),
        stock: buildProductStockOverview(this.store, product.id),
      }));
  }

  cotizarProducto(input: {
    productId: string;
    quantity: number;
    customerId?: string;
  }) {
    const product = findPublishedProduct(this.store, input.productId);
    const preview = this.quotes.previewPricing({
      customerId: input.customerId,
      items: [catalogLine(product, input.quantity)],
    });
    const [line] = preview.items;
    return {
      productId: product.id,
      name: product.name,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      listUnitPrice: line.listUnitPrice ?? line.unitPrice,
      total: preview.total,
      priceType: preview.priceType,
      wholesaleApplied: preview.wholesaleApplied,
    };
  }

  verCola(input: { hours?: number }) {
    const queue = this.printerQueue.getPrinterQueue();
    return {
      printers: queue.printers.map((row) => ({
        name: row.profile.name,
        busyUntil: row.busyUntil,
        queuedHours: row.queuedHours,
        jobs: row.jobs.length,
      })),
      unassignedJobs: queue.unassigned.length,
      ...(input.hours
        ? { deliveryEstimate: this.printerQueue.deliveryEstimate(input.hours) }
        : {}),
    };
  }

  async crearPresupuesto(
    input: {
      customerId?: string;
      items: { productId: string; quantity: number }[];
      description?: string;
    },
    apiKey: ApiKeyPrincipal,
  ) {
    const quote = this.quotes.create({
      customerId: input.customerId,
      description: input.description,
      items: input.items.map((item) =>
        catalogLine(
          findPublishedProduct(this.store, item.productId),
          item.quantity,
        ),
      ),
    });
    this.storeChange.recordChange({
      collections: ['quotes'],
      realtime: {
        scopes: ['dashboard', 'quotes'],
        action: 'create',
        entity: 'quote',
        id: quote.id,
      },
    });
    const approval = await this.approvals.create({
      kind: 'quote',
      payload: { quoteId: quote.id },
      summary: `Presupuesto ${quote.id} para ${quote.customerName} por ${formatMoney(quote.total)}`,
      referenceId: quote.id,
      apiKey,
    });
    return {
      quoteId: quote.id,
      approvalId: approval.id,
      total: quote.total,
      estado: PENDING_APPROVAL,
    };
  }

  /** No registra el pago: lo deja esperando la aprobación de Isaías. */
  async registrarPago(
    input: {
      orderId: string;
      amount: number;
      method?: PaymentMethod;
      deposit?: boolean;
    },
    apiKey: ApiKeyPrincipal,
  ) {
    const order = this.orders.findOne(input.orderId);
    if (order.status === OrderStatus.CANCELADO) {
      throw new BadRequestException('No se puede cobrar un pedido cancelado');
    }
    const amountCents = toCents(input.amount);
    if (amountCents <= 0) {
      throw new BadRequestException('El monto debe ser mayor a cero');
    }
    if (amountCents > outstandingCents(order)) {
      throw new BadRequestException('El monto supera el saldo pendiente');
    }
    const approval = await this.approvals.create({
      kind: 'payment',
      payload: {
        orderId: order.id,
        amount: input.amount,
        method: input.method,
        deposit: input.deposit,
      },
      summary: `Pago de ${formatMoney(input.amount)} en el pedido ${order.id} de ${order.customerName}`,
      referenceId: order.id,
      apiKey,
    });
    return { approvalId: approval.id, estado: PENDING_APPROVAL };
  }
}
