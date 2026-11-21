import { ConflictException } from '@nestjs/common';
import { AlertsNotifier } from '../alerts/alerts-notifier';
import { OrdersService } from '../orders/orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { QuotesService } from '../quotes/quotes.service';
import { StoreChangeService } from '../store/store-change.service';
import { AgentApprovalsService } from './agent-approvals.service';

type Row = Record<string, unknown>;

describe('AgentApprovalsService', () => {
  let rows: Row[];
  let orders: { addPayment: jest.Mock };
  let quotes: { remove: jest.Mock };
  let notifier: { notifyOwnerWhatsApp: jest.Mock };
  let service: AgentApprovalsService;

  const apiKey = { id: 'key-1', name: 'Claude', scopes: [] };

  beforeEach(() => {
    rows = [];
    const find = (id: string) => rows.find((row) => row.id === id) ?? null;
    const prisma = {
      agentApproval: {
        create: jest.fn(({ data }: { data: Row }) => {
          const row = {
            status: 'pending',
            decidedAt: null,
            error: null,
            ...data,
          };
          rows.push(row);
          return Promise.resolve(row);
        }),
        findUnique: jest.fn(({ where }: { where: { id: string } }) =>
          Promise.resolve(find(where.id)),
        ),
        findUniqueOrThrow: jest.fn(({ where }: { where: { id: string } }) =>
          Promise.resolve(find(where.id)),
        ),
        updateMany: jest.fn(
          ({
            where,
            data,
          }: {
            where: { id: string; status: string };
            data: Row;
          }) => {
            const row = find(where.id);
            if (!row || row.status !== where.status) {
              return Promise.resolve({ count: 0 });
            }
            Object.assign(row, data);
            return Promise.resolve({ count: 1 });
          },
        ),
        update: jest.fn(
          ({ where, data }: { where: { id: string }; data: Row }) => {
            const row = find(where.id)!;
            Object.assign(row, data);
            return Promise.resolve(row);
          },
        ),
      },
    };
    orders = { addPayment: jest.fn() };
    quotes = { remove: jest.fn() };
    notifier = { notifyOwnerWhatsApp: jest.fn().mockResolvedValue(undefined) };
    service = new AgentApprovalsService(
      { isConfigured: () => true, prisma } as unknown as PrismaService,
      orders as unknown as OrdersService,
      quotes as unknown as QuotesService,
      { recordChange: jest.fn() } as unknown as StoreChangeService,
      notifier as unknown as AlertsNotifier,
    );
  });

  function createPayment() {
    return service.create({
      kind: 'payment',
      payload: { orderId: 'ord-1', amount: 500 },
      summary: 'Pago de $ 500 en el pedido ord-1',
      referenceId: 'ord-1',
      apiKey,
    });
  }

  function createQuote() {
    return service.create({
      kind: 'quote',
      payload: { quoteId: 'quo-1' },
      summary: 'Presupuesto quo-1',
      referenceId: 'quo-1',
      apiKey,
    });
  }

  it('crear una aprobación avisa a Isaías por WhatsApp', async () => {
    const approval = await createPayment();

    expect(approval.status).toBe('pending');
    expect(notifier.notifyOwnerWhatsApp).toHaveBeenCalledTimes(1);
    const [text] = notifier.notifyOwnerWhatsApp.mock.calls[0] as [string];
    expect(text).toContain('Pago de $ 500');
  });

  it('aprobar un pago lo registra una sola vez; la segunda aprobación da 409', async () => {
    const { id } = await createPayment();

    const approved = await service.approve(id, 'user-1');
    await expect(service.approve(id, 'user-1')).rejects.toBeInstanceOf(
      ConflictException,
    );

    expect(approved.status).toBe('approved');
    expect(orders.addPayment).toHaveBeenCalledTimes(1);
    expect(orders.addPayment).toHaveBeenCalledWith('ord-1', {
      orderId: 'ord-1',
      amount: 500,
    });
  });

  it('si el pago falla al aprobar, queda fallida con el error', async () => {
    orders.addPayment.mockImplementation(() => {
      throw new Error('El monto supera el saldo pendiente');
    });
    const { id } = await createPayment();

    const result = await service.approve(id);

    expect(result.status).toBe('failed');
    expect(result.error).toBe('El monto supera el saldo pendiente');
  });

  it('rechazar un pago no toca el pedido', async () => {
    const { id } = await createPayment();

    const result = await service.reject(id);

    expect(result.status).toBe('rejected');
    expect(orders.addPayment).not.toHaveBeenCalled();
  });

  it('aprobar un presupuesto no lo cambia ni lo borra', async () => {
    const { id } = await createQuote();

    const result = await service.approve(id);

    expect(result.status).toBe('approved');
    expect(quotes.remove).not.toHaveBeenCalled();
    expect(orders.addPayment).not.toHaveBeenCalled();
  });

  it('rechazar un presupuesto lo borra', async () => {
    const { id } = await createQuote();

    const result = await service.reject(id);

    expect(result.status).toBe('rejected');
    expect(quotes.remove).toHaveBeenCalledWith('quo-1');
  });
});
