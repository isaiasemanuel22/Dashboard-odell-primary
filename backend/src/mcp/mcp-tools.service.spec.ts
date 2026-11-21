import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { AgentApprovalsService } from '../agent-approvals/agent-approvals.service';
import {
  CustomerType,
  OrderStatus,
  PriceType,
  ProductType,
  ServiceType,
} from '../common/enums';
import { Product } from '../common/interfaces';
import { OrdersService } from '../orders/orders.service';
import { OrderTasksService } from '../print-jobs/order-tasks.service';
import { PrintJobsService } from '../print-jobs/print-jobs.service';
import { PrinterQueueService } from '../print-jobs/printer-queue.service';
import { QuotesService } from '../quotes/quotes.service';
import { CostCalculatorService } from '../settings/cost-calculator.service';
import { DEFAULT_AGENT_TOOLS } from '../settings/agent-tools.util';
import {
  CustomerRepository,
  OrderRepository,
  ProductRepository,
  QuoteRepository,
} from '../store/repositories';
import { StoreChangeService } from '../store/store-change.service';
import { StoreService } from '../store/store.service';
import { createEmptyState } from '../store/store.seed';
import { buildMcpServer } from './mcp-server.factory';
import { McpToolsService } from './mcp-tools.service';

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: 'prod-1',
    name: 'Pieza',
    type: ProductType.FDM,
    images: [],
    attachments: [],
    updatedAt: '2026-10-21T12:00:00.000Z',
    price: 1000,
    cost: 400,
    profit: 600,
    categoryIds: [],
    size: '10 cm',
    published: true,
    components: [],
    assemblyTimeHours: 0,
    includesPieces: false,
    grams: 10,
    printTimeHours: 1,
    workTimeHours: 0,
    stock: 5,
    ...overrides,
  } as Product;
}

function setup() {
  const store = new StoreService();
  const state = createEmptyState();
  state.customers.push(
    {
      id: 'cust-rev',
      name: 'Revendedor',
      email: 'rev@test.com',
      phone: '111',
      type: CustomerType.REVENDEDOR,
      createdAt: '2026-10-21T12:00:00.000Z',
    },
    {
      id: 'cust-part',
      name: 'Particular',
      email: 'part@test.com',
      phone: '222',
      type: CustomerType.PARTICULAR,
      createdAt: '2026-10-21T12:00:00.000Z',
    },
  );
  state.products.push(
    product(),
    product({ id: 'prod-2', name: 'Oculta', published: false }),
  );
  state.orders.push({
    id: 'ord-1',
    customerId: 'cust-part',
    customerName: 'Particular',
    services: [ServiceType.IMPRESION_3D],
    items: [],
    status: OrderStatus.PENDIENTE,
    total: 1000,
    payments: [],
    createdAt: '2026-10-21T12:00:00.000Z',
    dueDate: '2026-12-21T18:00:00.000Z',
  });
  store.applyState(state);

  const orderTasks = new OrderTasksService(store);
  const orders = new OrdersService(
    new OrderRepository(store),
    new CustomerRepository(store),
    new ProductRepository(store),
    orderTasks,
    new PrintJobsService(store, orderTasks),
    new CostCalculatorService(store),
    store,
  );
  const storeChange = {
    recordChange: jest.fn(),
  } as unknown as StoreChangeService;
  const quotes = new QuotesService(
    new QuoteRepository(store),
    new CustomerRepository(store),
    orders,
    new ProductRepository(store),
    store,
    storeChange,
  );
  const approvals = { create: jest.fn().mockResolvedValue({ id: 'apr-1' }) };
  const tools = new McpToolsService(
    store,
    quotes,
    orders,
    new PrinterQueueService(store, orderTasks),
    approvals as unknown as AgentApprovalsService,
    storeChange,
  );
  return { store, tools, approvals };
}

const apiKey = {
  id: 'key-1',
  name: 'Claude',
  scopes: ['catalogo:leer' as const, 'pagos:proponer' as const],
};

describe('McpToolsService', () => {
  it('consultar_stock devuelve el disponible de los productos publicados', () => {
    const { tools } = setup();

    const result = tools.consultarStock({});

    expect(result).toEqual([
      {
        productId: 'prod-1',
        name: 'Pieza',
        price: 1000,
        stock: { physical: 5, reserved: 0, available: 5 },
      },
    ]);
  });

  it('cotizar_producto: revendedor → mayorista, particular → lista', () => {
    const { tools } = setup();

    const wholesale = tools.cotizarProducto({
      productId: 'prod-1',
      quantity: 2,
      customerId: 'cust-rev',
    });
    const list = tools.cotizarProducto({
      productId: 'prod-1',
      quantity: 2,
      customerId: 'cust-part',
    });

    expect(wholesale.priceType).toBe(PriceType.MAYORISTA);
    expect(wholesale.unitPrice).toBe(800);
    expect(wholesale.total).toBe(1600);
    expect(list.priceType).toBe(PriceType.LISTA);
    expect(list.unitPrice).toBe(1000);
    expect(list.total).toBe(2000);
  });

  it('cotizar_producto no cotiza productos no publicados', () => {
    const { tools } = setup();
    expect(() =>
      tools.cotizarProducto({ productId: 'prod-2', quantity: 1 }),
    ).toThrow('no encontrado');
  });

  it('registrar_pago crea la aprobación y no toca los pagos del pedido', async () => {
    const { tools, store, approvals } = setup();

    const result = await tools.registrarPago(
      { orderId: 'ord-1', amount: 500 },
      apiKey,
    );

    expect(result).toEqual({
      approvalId: 'apr-1',
      estado: 'pendiente de aprobación',
    });
    expect(store.orders[0].payments).toEqual([]);
    const [approval] = approvals.create.mock.calls[0] as [
      { kind: string; referenceId: string; payload: Record<string, unknown> },
    ];
    expect(approval.kind).toBe('payment');
    expect(approval.referenceId).toBe('ord-1');
    expect(approval.payload).toMatchObject({ orderId: 'ord-1', amount: 500 });
  });

  it('registrar_pago rechaza un monto mayor al saldo', async () => {
    const { tools, approvals } = setup();

    await expect(
      tools.registrarPago({ orderId: 'ord-1', amount: 1500 }, apiKey),
    ).rejects.toThrow('saldo pendiente');
    expect(approvals.create).not.toHaveBeenCalled();
  });
});

describe('buildMcpServer', () => {
  async function listTools(
    scopes: typeof apiKey.scopes,
    agentTools = DEFAULT_AGENT_TOOLS,
  ): Promise<string[]> {
    const { tools } = setup();
    const server = buildMcpServer({ ...apiKey, scopes }, agentTools, tools);
    const client = new Client({ name: 'test', version: '1.0.0' });
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
    const { tools: listed } = await client.listTools();
    await client.close();
    return listed.map((tool) => tool.name).sort();
  }

  it('no registra una herramienta apagada ni una sin permiso en la llave', async () => {
    // registrar_pago arranca apagada aunque la llave tenga pagos:proponer.
    expect(await listTools(['catalogo:leer', 'pagos:proponer'])).toEqual([
      'consultar_stock',
      'cotizar_producto',
    ]);
    expect(
      await listTools(['catalogo:leer', 'pagos:proponer'], {
        ...DEFAULT_AGENT_TOOLS,
        consultar_stock: false,
        registrar_pago: true,
      }),
    ).toEqual(['cotizar_producto', 'registrar_pago']);
  });
});
