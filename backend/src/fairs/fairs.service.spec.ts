import { BadRequestException } from '@nestjs/common';
import {
  FairStatus,
  PaymentMethod,
  TreasuryExpenseCategory,
  TreasuryMovementDirection,
} from '../common/enums';
import { Product } from '../common/interfaces';
import { SalesService } from '../sales/sales.service';
import { CostCalculatorService } from '../settings/cost-calculator.service';
import { createEmptyState } from '../store/store.seed';
import { StoreService } from '../store/store.service';
import {
  FairRepository,
  OrderRepository,
  ProductRepository,
  RetailSaleRepository,
  TreasuryExpenseRepository,
} from '../store/repositories';
import { FairsService } from './fairs.service';

describe('FairsService', () => {
  let store: StoreService;
  let sales: SalesService;
  let service: FairsService;

  beforeEach(() => {
    store = new StoreService();
    store.applyState(createEmptyState());
    store.products.push(
      { id: 'p1', name: 'Llavero', stock: 2 } as unknown as Product,
      { id: 'p2', name: 'Árbol', stock: 20 } as unknown as Product,
    );
    const fairs = new FairRepository(store);
    const retail = new RetailSaleRepository(store);
    const products = new ProductRepository(store);
    sales = new SalesService(
      retail,
      new OrderRepository(store),
      products,
      {
        resolveCatalogUnitCost: () => 0,
        // Precio del catálogo = 100; costo unitario = 40.
        resolveCatalogUnitPrice: () => 100,
        resolveDesignUnitCost: () => 0,
        resolveOrderItemUnitCost: () => 40,
      } as unknown as CostCalculatorService,
      fairs,
    );
    service = new FairsService(
      fairs,
      retail,
      new TreasuryExpenseRepository(store),
      products,
      sales,
      store,
    );
  });

  function openFair(name = 'Feria Plaza', float = 1000) {
    const fair = service.create({ name, date: '2026-11-17' });
    return service.open(fair.id, { openingFloat: float });
  }

  function sell(
    fairId: string,
    quantity: number,
    method = PaymentMethod.EFECTIVO,
    productId = 'p1',
  ) {
    return sales.createRetail({
      items: [{ productId, quantity, unitPrice: 0 }],
      method,
      fairId,
    });
  }

  it('calcula vendido, costo, gastos y resultado', () => {
    const fair = openFair();
    sell(fair.id, 3); // 300 efectivo
    sell(fair.id, 2, PaymentMethod.MERCADO_PAGO); // 200 MP
    service.addExpense(fair.id, { name: 'Stand', amount: 150 });

    const detail = service.detail(fair.id);
    expect(detail.salesCount).toBe(2);
    expect(detail.sold).toBe(500);
    expect(detail.cost).toBe(200); // 5 u × 40
    expect(detail.expenses).toBe(150);
    expect(detail.result).toBe(150);
    expect(detail.byMethod).toEqual({
      efectivo: 300,
      mercado_pago: 200,
      transferencia: 0,
    });
    expect(detail.expectedCash).toBe(1300);
    expect(detail.bestHour?.count).toBe(2);
    expect(detail.expensesList).toHaveLength(1);
  });

  it('los gastos anulados no cuentan', () => {
    const fair = openFair();
    const expense = service.addExpense(fair.id, { name: 'Nafta', amount: 80 });
    expense.voidedAt = new Date().toISOString();
    expect(service.detail(fair.id).expenses).toBe(0);
  });

  it('cierre sin diferencia no crea movimientos', () => {
    const fair = openFair();
    sell(fair.id, 1);
    const closed = service.close(fair.id, { countedCash: 1100 });
    expect(closed.status).toBe(FairStatus.CLOSED);
    expect(closed.cashDifference).toBe(0);
    expect(store.treasuryExpenses).toHaveLength(0);
  });

  it('cierre con faltante registra egreso en caja y exige motivo', () => {
    const fair = openFair();
    sell(fair.id, 1); // esperado 1100
    expect(() => service.close(fair.id, { countedCash: 1050 })).toThrow(
      BadRequestException,
    );
    const closed = service.close(fair.id, {
      countedCash: 1050,
      differenceReason: 'Vuelto mal dado',
    });
    expect(closed.cashDifference).toBe(-50);
    const [record] = store.treasuryExpenses;
    expect(record.direction).toBe(TreasuryMovementDirection.EXPENSE);
    expect(record.category).toBe(TreasuryExpenseCategory.FAIR);
    expect(record.amount).toBe(50);
    expect(record.account).toBe('caja');
    expect(record.description).toBe('Vuelto mal dado');
    // La diferencia se informa pero no cuenta como gasto.
    expect(service.detail(fair.id).expenses).toBe(0);
  });

  it('cierre con sobrante registra ingreso', () => {
    const fair = openFair();
    service.close(fair.id, { countedCash: 1020, differenceReason: 'Propina' });
    expect(store.treasuryExpenses[0].direction).toBe(
      TreasuryMovementDirection.INCOME,
    );
  });

  it('feria cerrada: sin ventas, gastos, ediciones ni reapertura', () => {
    const fair = openFair();
    const sale = sell(fair.id, 1);
    service.close(fair.id, { countedCash: 1100 });

    expect(() => sell(fair.id, 1)).toThrow('cerrada');
    expect(() => sales.updateRetail(sale.id, { notes: 'x' })).toThrow(
      'cerrada',
    );
    expect(() => sales.removeRetail(sale.id)).toThrow('cerrada');
    expect(() => service.addExpense(fair.id, { name: 'x', amount: 1 })).toThrow(
      'cerrada',
    );
    expect(() => service.update(fair.id, { name: 'Otra' })).toThrow('cerrada');
    expect(() => service.open(fair.id, { openingFloat: 0 })).toThrow(
      BadRequestException,
    );
    expect(() => service.close(fair.id, { countedCash: 0 })).toThrow(
      'ya está cerrada',
    );
  });

  it('rechaza ventas en una feria planificada o inexistente', () => {
    const planned = service.create({ name: 'F', date: '2026-12-01' });
    expect(() => sell(planned.id, 1)).toThrow('todavía no está abierta');
    expect(() => sell('fair-999', 1)).toThrow('no encontrada');
  });

  it('el listado de ventas muestra «Feria <nombre>» como origen', () => {
    const fair = openFair('Feria Plaza');
    sell(fair.id, 1);
    sales.createRetail({
      items: [{ productId: 'p1', quantity: 1, unitPrice: 0 }],
    });
    const named = service.create({ name: 'Plaza Norte', date: '2026-11-17' });
    service.open(named.id, { openingFloat: 0 });
    sell(named.id, 1);
    const names = sales.listEntries().map((entry) => entry.customerName);
    // El nombre ya empieza con «Feria»: no se repite el prefijo.
    expect(names).toContain('Feria Plaza');
    expect(names).not.toContain('Feria Feria Plaza');
    expect(names).toContain('Feria Plaza Norte');
    expect(names).toContain('Mostrador');
  });

  it('borrar solo si no tiene ventas ni gastos', () => {
    const withSale = openFair();
    sell(withSale.id, 1);
    expect(() => service.remove(withSale.id)).toThrow('ventas');

    const withExpense = openFair('Otra');
    service.addExpense(withExpense.id, { name: 'Stand', amount: 10 });
    expect(() => service.remove(withExpense.id)).toThrow('gastos');

    const empty = service.create({ name: 'Vacía', date: '2026-12-01' });
    service.remove(empty.id);
    expect(store.fairs.find((f) => f.id === empty.id)).toBeUndefined();
  });

  describe('qué llevar', () => {
    function closedFair(name: string, date: string, p1: number, p2 = 0) {
      const fair = service.create({ name, date });
      service.open(fair.id, { openingFloat: 0 });
      sell(fair.id, p1);
      if (p2) sell(fair.id, p2, PaymentMethod.EFECTIVO, 'p2');
      service.close(fair.id, { countedCash: p1 * 100 + p2 * 100 });
    }

    it('promedia las últimas 3 cerradas con el mismo nombre', () => {
      closedFair('Plaza', '2026-08-01', 100); // fuera: es la 4ta más vieja
      closedFair('plaza', '2026-09-01', 4, 1);
      closedFair('PLAZA', '2026-10-01', 6, 2);
      closedFair('Plaza ', '2026-11-01', 5);
      closedFair('Otra feria', '2026-11-05', 50);
      // Una abierta con el mismo nombre no cuenta.
      openFair('Plaza');

      const plan = service.plan('Plaza');
      expect(plan.basedOn).toBe(3);
      // p1: (4+6+5)/3 = 5 → take 6; el stock quedó en 0 por las ventas → imprimir 6
      // p2: (1+2+0)/3 = 1 → take 2; stock 20 → imprimir 0
      expect(plan.items.map((i) => i.productId)).toEqual(['p1', 'p2']);
      expect(plan.items[0]).toMatchObject({
        average: 5,
        take: 6,
        toPrint: 6, // el stock bajó a 0 con las ventas de prueba
      });
      expect(plan.items[1]).toMatchObject({ take: 2, toPrint: 0 });
    });

    it('con menos de 3 usa las que haya y sin historial devuelve vacío', () => {
      closedFair('Solo una', '2026-10-01', 3);
      expect(service.plan('solo una').basedOn).toBe(1);
      expect(service.plan('Nunca fui')).toEqual({ basedOn: 0, items: [] });
    });
  });

  it('listado: filtra por mes y arma KPI', () => {
    const fair = openFair();
    sell(fair.id, 2);
    service.create({ name: 'Octubre', date: '2026-10-05' });
    const all = service.list();
    expect(all.fairs.map((f) => f.date)).toEqual(['2026-11-17', '2026-10-05']);
    const november = service.list('2026-11');
    expect(november.fairs).toHaveLength(1);
    expect(november.kpis).toMatchObject({
      sold: 200,
      net: 120,
      fairsCount: 1,
      bestFair: { id: fair.id, result: 120 },
      topProduct: { productId: 'p1', quantity: 2 },
    });
  });
});
