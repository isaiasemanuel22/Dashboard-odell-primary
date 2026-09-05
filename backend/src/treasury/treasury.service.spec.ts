import {
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
    Pick<SuppliesService, 'recordPurchase' | 'notifySupplyAvailability'>
  >;

  beforeEach(() => {
    store = new StoreService();
    store.applyState(createEmptyState());

    store.retailSales.push({
      id: 'sale-1',
      items: [],
      total: 10000,
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
    );
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
    expect(store.supplies.find((item) => item.id === 'sup-1')?.quantity).toBe(3);
    expect(store.supplies.find((item) => item.id === 'sup-2')?.quantity).toBe(1);
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
});
