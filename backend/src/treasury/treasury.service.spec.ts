import {
  OrderStatus,
  PaymentMethod,
  ServiceType,
  TreasuryAccount,
  TreasuryExpenseCategory,
  TreasuryMovementDirection,
} from '../common/enums';
import { SalesService } from '../sales/sales.service';
import { SuppliesService } from '../supplies/supplies.service';
import {
  OrderRepository,
  ProductRepository,
  RetailSaleRepository,
  SupplyRepository,
  TreasuryExpenseRepository,
} from '../store/repositories';
import { StoreChangeService } from '../store/store-change.service';
import { StoreService } from '../store/store.service';
import { createEmptyState } from '../store/store.seed';
import { TreasuryService } from './treasury.service';

describe('TreasuryService', () => {
  let store: StoreService;
  let service: TreasuryService;
  let storeChange: jest.Mocked<Pick<StoreChangeService, 'recordChange'>>;
  let suppliesService: jest.Mocked<
    Pick<
      SuppliesService,
      'recordPurchase' | 'notifySupplyAvailability' | 'noteStockChange'
    >
  >;

  beforeEach(() => {
    store = new StoreService();
    store.applyState(createEmptyState());

    store.retailSales.push({
      id: 'sale-1',
      items: [],
      total: 10000,
      method: PaymentMethod.EFECTIVO,
      account: TreasuryAccount.CAJA,
      soldAt: '2026-08-01T12:00:00.000Z',
      createdAt: '2026-08-01T12:00:00.000Z',
    });

    store.supplies.push({
      id: 'sup-1',
      name: 'Filamento PLA',
      category: 'fdm' as never,
      unit: 'kg',
      quantity: 1,
      minStock: 0,
      unitPrice: 2500,
      priceFromSettings: false,
      updatedAt: '2026-08-01T12:00:00.000Z',
    });

    const sales = new SalesService(
      new RetailSaleRepository(store),
      new OrderRepository(store),
      new ProductRepository(store),
      {} as never,
    );

    suppliesService = {
      recordPurchase: jest.fn(
        (
          supplyId: string,
          data: { quantityDelta: number; unitPrice?: number },
          _options?: { persist?: boolean; notify?: boolean },
        ) => {
          const supply = store.supplies.find((item) => item.id === supplyId)!;
          supply.quantity += data.quantityDelta;
          if (data.unitPrice !== undefined) {
            supply.unitPrice = data.unitPrice;
            supply.priceFromSettings = false;
          }
          return supply;
        },
      ),
      notifySupplyAvailability: jest.fn(),
      noteStockChange: jest.fn(),
    };

    storeChange = {
      recordChange: jest.fn(),
    };

    service = new TreasuryService(
      sales,
      new TreasuryExpenseRepository(store),
      new SupplyRepository(store),
      suppliesService as unknown as SuppliesService,
      storeChange as unknown as StoreChangeService,
      new OrderRepository(store),
      new RetailSaleRepository(store),
    );
  });

  it('rechaza un total que no coincide en centavos con la suma de gastos', () => {
    expect(() =>
      service.recordExpense({
        isSupplyPurchase: true,
        amount: 100,
        occurredAt: '2026-08-10',
        supplyLines: [
          {
            supplyId: 'sup-1',
            quantity: 0.01,
            amountSpent: 100.4,
            unitPrice: 10000,
          },
        ],
      }),
    ).toThrow('no coincide');

    expect(store.treasuryExpenses).toHaveLength(0);
    expect(store.supplies[0]?.quantity).toBe(1);
  });

  it('pide el formato AAAA-MM-DD cuando la fecha trae hora', () => {
    expect(() =>
      service.recordExpense({
        isSupplyPurchase: false,
        direction: TreasuryMovementDirection.EXPENSE,
        name: 'Transporte',
        amount: 10,
        occurredAt: '2026-10-21T15:00:00.000Z',
      }),
    ).toThrow('AAAA-MM-DD');
  });

  it('llama material a la compra de filamento', () => {
    const [expense] = service.recordExpense({
      isSupplyPurchase: true,
      amount: 2500,
      occurredAt: '2026-08-10',
      supplyLines: [
        {
          supplyId: 'sup-1',
          quantity: 1,
          amountSpent: 2500,
          unitPrice: 2500,
        },
      ],
    });

    expect(expense.description).toBe('Compra de material: Filamento PLA');
  });

  it('registra egresos simples con nombre, monto y fecha', () => {
    const [expense] = service.recordExpense({
      isSupplyPurchase: false,
      direction: TreasuryMovementDirection.EXPENSE,
      name: 'Transporte',
      amount: 3000,
      occurredAt: '2026-08-10',
    });

    expect(expense).toMatchObject({
      name: 'Transporte',
      amount: 3000,
      direction: TreasuryMovementDirection.EXPENSE,
      category: TreasuryExpenseCategory.OTHER,
    });
    expect(service.getAvailableBalance()).toBe(7000);
  });

  it('registra ingresos manuales y los suma al saldo', () => {
    service.recordExpense({
      isSupplyPurchase: false,
      direction: TreasuryMovementDirection.INCOME,
      name: 'Aporte socio',
      amount: 2000,
      occurredAt: '2026-08-10',
    });

    expect(service.getAvailableBalance()).toBe(12000);
    expect(service.getOverview().totalManualIncome).toBe(2000);
  });

  it('registra compra de insumos y actualiza stock', () => {
    const expenses = service.recordExpense({
      isSupplyPurchase: true,
      amount: 4800,
      occurredAt: '2026-08-10',
      supplyLines: [
        {
          supplyId: 'sup-1',
          quantity: 2,
          amountSpent: 4800,
          unitPrice: 2500,
        },
      ],
    });

    expect(expenses).toHaveLength(1);
    expect(expenses[0]).toMatchObject({
      name: 'Filamento PLA',
      amount: 4800,
      direction: TreasuryMovementDirection.EXPENSE,
      category: TreasuryExpenseCategory.SUPPLY_PURCHASE,
    });
    expect(suppliesService.recordPurchase).toHaveBeenCalledWith(
      'sup-1',
      {
        quantityDelta: 2,
        unitPrice: 2500,
      },
      { persist: false, notify: false },
    );
    expect(store.supplies[0]?.quantity).toBe(3);
    expect(storeChange.recordChange).toHaveBeenCalledTimes(1);
    expect(storeChange.recordChange).toHaveBeenCalledWith(
      expect.objectContaining({
        collections: ['treasuryExpenses', 'supplies'],
      }),
    );
    expect(suppliesService.notifySupplyAvailability).toHaveBeenCalledTimes(1);
  });

  it('no registra egresos ni stock si un insumo de la compra no existe', () => {
    expect(() =>
      service.recordExpense({
        isSupplyPurchase: true,
        amount: 9600,
        occurredAt: '2026-08-10',
        supplyLines: [
          {
            supplyId: 'sup-1',
            quantity: 2,
            amountSpent: 4800,
            unitPrice: 2500,
          },
          {
            supplyId: 'sup-missing',
            quantity: 1,
            amountSpent: 4800,
            unitPrice: 2500,
          },
        ],
      }),
    ).toThrow('sup-missing');

    expect(store.treasuryExpenses).toHaveLength(0);
    expect(store.supplies[0]?.quantity).toBe(1);
    expect(suppliesService.recordPurchase).not.toHaveBeenCalled();
    expect(storeChange.recordChange).not.toHaveBeenCalled();
    expect(suppliesService.notifySupplyAvailability).not.toHaveBeenCalled();
  });

  it('registra compra con varios insumos de forma atómica', () => {
    store.supplies.push({
      id: 'sup-2',
      name: 'Resina',
      category: 'resina' as never,
      unit: 'L',
      quantity: 0.5,
      minStock: 0,
      unitPrice: 8000,
      priceFromSettings: false,
      updatedAt: '2026-08-01T12:00:00.000Z',
    });

    const expenses = service.recordExpense({
      isSupplyPurchase: true,
      amount: 8800,
      occurredAt: '2026-08-10',
      supplyLines: [
        {
          supplyId: 'sup-1',
          quantity: 2,
          amountSpent: 4800,
          unitPrice: 2500,
        },
        {
          supplyId: 'sup-2',
          quantity: 0.5,
          amountSpent: 4000,
          unitPrice: 8000,
        },
      ],
    });

    expect(expenses).toHaveLength(2);
    expect(store.treasuryExpenses).toHaveLength(2);
    expect(store.supplies.find((item) => item.id === 'sup-1')?.quantity).toBe(
      3,
    );
    expect(store.supplies.find((item) => item.id === 'sup-2')?.quantity).toBe(
      1,
    );
    expect(suppliesService.recordPurchase).toHaveBeenCalledTimes(2);
    expect(storeChange.recordChange).toHaveBeenCalledTimes(1);
  });

  it('actualiza el precio unitario del insumo si cambió en la compra', () => {
    service.recordExpense({
      isSupplyPurchase: true,
      amount: 4800,
      occurredAt: '2026-08-10',
      supplyLines: [
        {
          supplyId: 'sup-1',
          quantity: 2,
          amountSpent: 4800,
          unitPrice: 2400,
        },
      ],
    });

    expect(suppliesService.recordPurchase).toHaveBeenCalledWith(
      'sup-1',
      {
        quantityDelta: 2,
        unitPrice: 2400,
      },
      { persist: false, notify: false },
    );
  });

  it('registra un pago a una persona como egreso', () => {
    const [expense] = service.recordExpense({
      isSupplyPurchase: false,
      category: TreasuryExpenseCategory.PAYMENT,
      name: 'Juan',
      amount: 15000,
      occurredAt: '2026-08-10',
    });

    expect(expense).toMatchObject({
      name: 'Juan',
      amount: 15000,
      direction: TreasuryMovementDirection.EXPENSE,
      category: TreasuryExpenseCategory.PAYMENT,
      description: 'Pago a Juan',
    });
    expect(service.getAvailableBalance()).toBe(-5000);
    expect(service.getOverview().recipientNameSuggestions).toEqual(['Juan']);
    expect(service.getOverview().debtors).toEqual([]);
  });

  it('calcula deudores netos restando devoluciones', () => {
    service.recordExpense({
      isSupplyPurchase: false,
      category: TreasuryExpenseCategory.LOAN,
      name: 'María',
      amount: 10000,
      occurredAt: '2026-08-10',
    });
    store.treasuryExpenses.push({
      id: 'rep-1',
      direction: TreasuryMovementDirection.INCOME,
      category: TreasuryExpenseCategory.LOAN_REPAYMENT,
      name: 'María',
      quantity: 1,
      unitPrice: 3000,
      amount: 3000,
      description: 'Devolución de María',
      occurredAt: '2026-08-11T12:00:00.000Z',
      createdAt: '2026-08-11T12:00:00.000Z',
    });

    expect(service.getOverview().debtors).toEqual([
      { name: 'María', amount: 7000 },
    ]);
  });

  it('registra una devolución parcial y actualiza deuda y saldo', () => {
    service.recordExpense({
      isSupplyPurchase: false,
      category: TreasuryExpenseCategory.LOAN,
      name: 'María',
      amount: 10000,
      occurredAt: '2026-08-10',
    });

    const [repayment] = service.recordExpense({
      isSupplyPurchase: false,
      category: TreasuryExpenseCategory.LOAN_REPAYMENT,
      name: 'María',
      amount: 4000,
      occurredAt: '2026-08-11',
    });

    expect(repayment).toMatchObject({
      name: 'María',
      amount: 4000,
      direction: TreasuryMovementDirection.INCOME,
      category: TreasuryExpenseCategory.LOAN_REPAYMENT,
    });
    expect(service.getOverview().debtors).toEqual([
      { name: 'María', amount: 6000 },
    ]);
    expect(service.getAvailableBalance()).toBe(4000);
  });

  it('rechaza devoluciones mayores a la deuda pendiente', () => {
    service.recordExpense({
      isSupplyPurchase: false,
      category: TreasuryExpenseCategory.LOAN,
      name: 'María',
      amount: 5000,
      occurredAt: '2026-08-10',
    });

    expect(() =>
      service.recordExpense({
        isSupplyPurchase: false,
        category: TreasuryExpenseCategory.LOAN_REPAYMENT,
        name: 'María',
        amount: 6000,
        occurredAt: '2026-08-11',
      }),
    ).toThrow('deuda pendiente');
  });

  it('registra un préstamo a una persona como egreso', () => {
    const [expense] = service.recordExpense({
      isSupplyPurchase: false,
      category: TreasuryExpenseCategory.LOAN,
      name: 'María',
      amount: 8000,
      occurredAt: '2026-08-10',
    });

    expect(expense).toMatchObject({
      name: 'María',
      amount: 8000,
      category: TreasuryExpenseCategory.LOAN,
      description: 'Préstamo a María',
    });
    expect(service.getOverview().debtors).toEqual([
      { name: 'María', amount: 8000 },
    ]);
  });

  it('edita un movimiento simple y actualiza el saldo', () => {
    const [expense] = service.recordExpense({
      isSupplyPurchase: false,
      direction: TreasuryMovementDirection.EXPENSE,
      name: 'QA-transporte',
      amount: 3000,
      occurredAt: '2026-08-10',
    });

    const updated = service.updateExpense(expense.id, {
      name: 'QA-transporte corregido',
      amount: 1000,
      direction: TreasuryMovementDirection.INCOME,
      occurredAt: '2026-08-09',
    });

    expect(updated).toMatchObject({
      id: expense.id,
      name: 'QA-transporte corregido',
      amount: 1000,
      direction: TreasuryMovementDirection.INCOME,
      category: TreasuryExpenseCategory.OTHER,
    });
    expect(service.getAvailableBalance()).toBe(11000);
    expect(store.treasuryExpenses).toHaveLength(1);
  });

  it('borra un movimiento simple y revierte el saldo', () => {
    const [expense] = service.recordExpense({
      isSupplyPurchase: false,
      direction: TreasuryMovementDirection.EXPENSE,
      name: 'QA-caja',
      amount: 4000,
      occurredAt: '2026-08-10',
    });

    service.removeExpense(expense.id);

    expect(store.treasuryExpenses).toHaveLength(0);
    expect(service.getAvailableBalance()).toBe(10000);
  });

  it('edita una compra de insumos y deja el stock en la cantidad nueva', () => {
    const [expense] = service.recordExpense({
      isSupplyPurchase: true,
      amount: 4800,
      occurredAt: '2026-08-10',
      supplyLines: [
        {
          supplyId: 'sup-1',
          quantity: 2,
          amountSpent: 4800,
          unitPrice: 2500,
        },
      ],
    });

    const updated = service.updateExpense(expense.id, {
      quantity: 5,
      amount: 9000,
      unitPrice: 2400,
    });

    expect(updated).toMatchObject({
      id: expense.id,
      quantity: 5,
      amount: 9000,
      unitPrice: 2400,
      referenceId: 'sup-1',
    });
    expect(store.supplies[0]?.quantity).toBe(6);
    expect(store.supplies[0]?.unitPrice).toBe(2400);
    expect(service.getAvailableBalance()).toBe(1000);
  });

  it('borra una compra de insumos y revierte el stock', () => {
    const [expense] = service.recordExpense({
      isSupplyPurchase: true,
      amount: 4800,
      occurredAt: '2026-08-10',
      supplyLines: [
        {
          supplyId: 'sup-1',
          quantity: 2,
          amountSpent: 4800,
          unitPrice: 2400,
        },
      ],
    });

    service.removeExpense(expense.id);

    expect(store.treasuryExpenses).toHaveLength(0);
    expect(store.supplies[0]?.quantity).toBe(1);
    expect(store.supplies[0]?.unitPrice).toBe(2400);
    expect(service.getAvailableBalance()).toBe(10000);
  });

  it('no borra la compra si el stock quedaría negativo', () => {
    const [expense] = service.recordExpense({
      isSupplyPurchase: true,
      amount: 4800,
      occurredAt: '2026-08-10',
      supplyLines: [
        {
          supplyId: 'sup-1',
          quantity: 2,
          amountSpent: 4800,
          unitPrice: 2500,
        },
      ],
    });
    store.supplies[0].quantity = 1;

    expect(() => service.removeExpense(expense.id)).toThrow('stock');
    expect(store.treasuryExpenses).toHaveLength(1);
    expect(store.supplies[0]?.quantity).toBe(1);
  });

  it('rechaza fechas futuras', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const occurredAt = tomorrow.toISOString().slice(0, 10);

    expect(() =>
      service.recordExpense({
        isSupplyPurchase: false,
        direction: TreasuryMovementDirection.EXPENSE,
        name: 'Transporte',
        amount: 1000,
        occurredAt,
      }),
    ).toThrow('La fecha no puede ser posterior a hoy');
  });

  it('resta comisiones de pagos al saldo por cuenta', () => {
    store.orders.push({
      id: 'ord-pay',
      customerId: null,
      customerName: 'Ana',
      services: [ServiceType.IMPRESION_3D],
      items: [],
      status: OrderStatus.PENDIENTE,
      total: 10000,
      payments: [
        {
          id: 'ord-pay-1',
          amount: 5000,
          deposit: true,
          createdAt: '2026-08-05T12:00:00.000Z',
          method: PaymentMethod.MERCADO_PAGO,
          account: TreasuryAccount.MERCADO_PAGO,
          fee: 200,
        },
      ],
      createdAt: '2026-08-01T12:00:00.000Z',
      dueDate: '2026-08-20T12:00:00.000Z',
    });

    const overview = service.getOverview();
    expect(overview.accounts).toEqual([
      { account: TreasuryAccount.CAJA, balance: 10000, fees: 0 },
      { account: TreasuryAccount.MERCADO_PAGO, balance: 4800, fees: 200 },
      { account: TreasuryAccount.BANCO, balance: 0, fees: 0 },
    ]);
    expect(overview.availableBalance).toBe(14800);
    expect(overview.totalSalesIncome).toBe(14800);
    expect(
      overview.movements.some(
        (movement) => movement.concept === 'Seña ord-pay · Ana',
      ),
    ).toBe(true);
  });

  it('asigna caja a registros viejos sin cuenta', () => {
    store.treasuryExpenses.push({
      id: 'legacy-1',
      direction: TreasuryMovementDirection.EXPENSE,
      category: TreasuryExpenseCategory.OTHER,
      name: 'Gas',
      quantity: 1,
      unitPrice: 1000,
      amount: 1000,
      occurredAt: '2026-08-05T12:00:00.000Z',
      createdAt: '2026-08-05T12:00:00.000Z',
    });
    store.orders.push({
      id: 'ord-legacy',
      customerId: null,
      customerName: 'Bruno',
      services: [ServiceType.IMPRESION_3D],
      items: [],
      status: OrderStatus.PENDIENTE,
      total: 3000,
      payments: [
        {
          id: 'pay-legacy',
          amount: 3000,
          deposit: false,
          createdAt: '2026-08-06T12:00:00.000Z',
        },
      ],
      createdAt: '2026-08-01T12:00:00.000Z',
      dueDate: '2026-08-20T12:00:00.000Z',
    });

    const overview = service.getOverview();
    const caja = overview.accounts.find(
      (entry) => entry.account === TreasuryAccount.CAJA,
    );
    expect(caja?.balance).toBe(10000 - 1000 + 3000);
    expect(
      overview.movements.find((movement) => movement.id === 'pay-legacy')
        ?.account,
    ).toBe(TreasuryAccount.CAJA);
  });

  it('transfiere entre cuentas sin cambiar el disponible total', () => {
    const before = service.getAvailableBalance();
    const [outbound, inbound] = service.transferBetweenAccounts({
      from: TreasuryAccount.CAJA,
      to: TreasuryAccount.BANCO,
      amount: 2500,
      occurredAt: '2026-08-10',
    });

    expect(outbound).toMatchObject({
      category: TreasuryExpenseCategory.TRANSFER,
      direction: TreasuryMovementDirection.EXPENSE,
      account: TreasuryAccount.CAJA,
      amount: 2500,
      referenceId: outbound.referenceId,
    });
    expect(inbound).toMatchObject({
      category: TreasuryExpenseCategory.TRANSFER,
      direction: TreasuryMovementDirection.INCOME,
      account: TreasuryAccount.BANCO,
      amount: 2500,
      referenceId: outbound.referenceId,
    });
    expect(service.getAvailableBalance()).toBe(before);

    const overview = service.getOverview();
    expect(
      overview.accounts.find((entry) => entry.account === TreasuryAccount.CAJA)
        ?.balance,
    ).toBe(7500);
    expect(
      overview.accounts.find((entry) => entry.account === TreasuryAccount.BANCO)
        ?.balance,
    ).toBe(2500);
  });

  it('anular una punta de la transferencia anula las dos', () => {
    const before = service.getAvailableBalance();
    const [outbound, inbound] = service.transferBetweenAccounts({
      from: TreasuryAccount.CAJA,
      to: TreasuryAccount.BANCO,
      amount: 2500,
      occurredAt: '2026-08-10',
    });

    service.voidExpense(outbound.id, 'Cargada por error');

    const records = service.listRecords();
    expect(records.find((r) => r.id === inbound.id)?.voidedAt).toBeTruthy();
    expect(service.getAvailableBalance()).toBe(before);
    expect(
      service
        .getOverview()
        .accounts.find((entry) => entry.account === TreasuryAccount.BANCO)
        ?.balance,
    ).toBe(0);
  });

  it('anula un registro: sale de totales, revierte stock y no se re-anula', () => {
    const [purchase] = service.recordExpense({
      isSupplyPurchase: true,
      amount: 4800,
      occurredAt: '2026-08-10',
      supplyLines: [
        {
          supplyId: 'sup-1',
          quantity: 2,
          amountSpent: 4800,
          unitPrice: 2400,
        },
      ],
    });
    expect(store.supplies[0]?.quantity).toBe(3);
    expect(service.getAvailableBalance()).toBe(5200);

    const voided = service.voidExpense(purchase.id, 'Error de carga');
    expect(voided.voidedAt).toBeTruthy();
    expect(voided.voidReason).toBe('Error de carga');
    expect(store.supplies[0]?.quantity).toBe(1);
    expect(service.getAvailableBalance()).toBe(10000);
    expect(service.getOverview().expenses).toHaveLength(1);
    expect(service.getOverview().totalExpenses).toBe(0);

    expect(() => service.voidExpense(purchase.id, 'Otra vez')).toThrow(
      /ya está anulado/,
    );
    expect(() => service.updateExpense(purchase.id, { amount: 1000 })).toThrow(
      /ya está anulado/,
    );
  });
});
