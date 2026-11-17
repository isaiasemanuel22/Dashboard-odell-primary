import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CloseFairDto,
  CreateFairDto,
  CreateFairExpenseDto,
  OpenFairDto,
  UpdateFairDto,
} from '../common/dto';
import {
  FairStatus,
  PaymentMethod,
  TreasuryAccount,
  TreasuryExpenseCategory,
  TreasuryMovementDirection,
} from '../common/enums';
import {
  Fair,
  FairDetail,
  FairPlan,
  FairPlanItem,
  FairsOverview,
  FairSummary,
  RetailSale,
  TreasuryExpense,
} from '../common/interfaces';
import { fairOriginLabel, SalesService } from '../sales/sales.service';
import {
  FairRepository,
  ProductRepository,
  RetailSaleRepository,
  TreasuryExpenseRepository,
} from '../store/repositories';
import { StoreService } from '../store/store.service';
import {
  bestTwoHourWindow,
  normalizeFairName,
  round2,
  unitsToPrint,
  unitsToTake,
} from './fairs.util';

const PLAN_FAIRS = 3;

/** Referencia del movimiento de diferencia de caja de un cierre. */
export function fairDifferenceRef(fairId: string): string {
  return `fair-diff-${fairId}`;
}

@Injectable()
export class FairsService {
  constructor(
    private readonly fairs: FairRepository,
    private readonly retailSales: RetailSaleRepository,
    private readonly expenses: TreasuryExpenseRepository,
    private readonly products: ProductRepository,
    private readonly sales: SalesService,
    private readonly store: StoreService,
  ) {}

  list(month?: string): FairsOverview {
    if (month && !/^\d{4}-\d{2}$/.test(month)) {
      throw new BadRequestException('El mes debe tener formato AAAA-MM');
    }
    const costBySale = this.costBySaleId();
    const selected = this.fairs
      .findAll()
      .filter((fair) => !month || fair.date.startsWith(month))
      .sort(
        (a, b) =>
          b.date.localeCompare(a.date) ||
          b.createdAt.localeCompare(a.createdAt),
      );
    const summaries = selected.map((fair) => this.summarize(fair, costBySale));

    // Los KPI cuentan ferias que ya se abrieron (las planificadas no vendieron).
    const held = summaries.filter((s) => s.status !== FairStatus.PLANNED);
    const heldIds = new Set(held.map((s) => s.id));
    const units = new Map<string, { name: string; quantity: number }>();
    for (const sale of this.retailSales.findAll()) {
      if (!sale.fairId || !heldIds.has(sale.fairId)) continue;
      for (const item of sale.items) {
        if (!item.productId) continue;
        const current = units.get(item.productId) ?? {
          name: item.productName,
          quantity: 0,
        };
        current.quantity += item.quantity;
        units.set(item.productId, current);
      }
    }
    let topProduct: FairsOverview['kpis']['topProduct'] = null;
    for (const [productId, value] of units) {
      if (!topProduct || value.quantity > topProduct.quantity) {
        topProduct = {
          productId,
          name: this.products.findById(productId)?.name ?? value.name,
          quantity: value.quantity,
        };
      }
    }
    let best: FairSummary | null = null;
    for (const summary of held) {
      if (!best || summary.result > best.result) best = summary;
    }

    return {
      fairs: summaries,
      kpis: {
        sold: round2(held.reduce((sum, s) => sum + s.sold, 0)),
        net: round2(held.reduce((sum, s) => sum + s.result, 0)),
        fairsCount: held.length,
        bestFair: best
          ? {
              id: best.id,
              name: best.name,
              date: best.date,
              result: best.result,
            }
          : null,
        topProduct,
      },
    };
  }

  detail(id: string): FairDetail {
    const fair = this.require(id);
    const fairSales = this.salesOf(id);
    const summary = this.summarize(fair, this.costBySaleId());

    const byMethod = { efectivo: 0, mercado_pago: 0, transferencia: 0 };
    for (const sale of fairSales) {
      const method = sale.method ?? PaymentMethod.EFECTIVO;
      byMethod[method] = round2(byMethod[method] + sale.total);
    }

    return {
      ...summary,
      byMethod,
      expectedCash: round2(fair.openingFloat + byMethod.efectivo),
      bestHour: bestTwoHourWindow(fairSales.map((sale) => sale.soldAt)),
      expensesList: this.expensesOf(id).map((expense) => ({
        id: expense.id,
        name: expense.name,
        amount: expense.amount,
        account: expense.account ?? TreasuryAccount.CAJA,
        occurredAt: expense.occurredAt,
      })),
      sales: [...fairSales]
        .sort((a, b) => b.soldAt.localeCompare(a.soldAt))
        .map((sale) => ({
          id: sale.id,
          soldAt: sale.soldAt,
          total: sale.total,
          method: sale.method ?? PaymentMethod.EFECTIVO,
          items: sale.items.map((item) => ({
            productId: item.productId,
            name: item.productName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          })),
        })),
    };
  }

  create(data: CreateFairDto): Fair {
    const name = this.parseName(data.name);
    this.assertValidDate(data.date);
    const calendarEntryId = this.parseCalendarEntryId(data.calendarEntryId);
    const now = new Date().toISOString();
    return this.fairs.create({
      id: this.fairs.nextId(),
      name,
      date: data.date,
      recurring: data.recurring ?? false,
      calendarEntryId,
      status: FairStatus.PLANNED,
      openedAt: null,
      openingFloat: round2(data.openingFloat ?? 0),
      closedAt: null,
      countedCash: null,
      cashDifference: null,
      differenceReason: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  update(id: string, data: UpdateFairDto): Fair {
    const current = this.require(id);
    this.assertNotClosed(current);
    const next: Fair = { ...current };
    if (data.name !== undefined) next.name = this.parseName(data.name);
    if (data.date !== undefined) {
      this.assertValidDate(data.date);
      next.date = data.date;
    }
    if (data.recurring !== undefined) next.recurring = data.recurring;
    if (data.calendarEntryId !== undefined) {
      next.calendarEntryId = this.parseCalendarEntryId(data.calendarEntryId);
    }
    next.updatedAt = new Date().toISOString();
    return this.fairs.save(next);
  }

  open(id: string, data: OpenFairDto): Fair {
    const current = this.require(id);
    if (current.status !== FairStatus.PLANNED) {
      throw new BadRequestException(
        current.status === FairStatus.CLOSED
          ? 'La feria está cerrada y no se puede abrir de nuevo'
          : 'La feria ya está abierta',
      );
    }
    const now = new Date().toISOString();
    return this.fairs.save({
      ...current,
      status: FairStatus.OPEN,
      openedAt: now,
      openingFloat: round2(data.openingFloat),
      updatedAt: now,
    });
  }

  addExpense(id: string, data: CreateFairExpenseDto): TreasuryExpense {
    const fair = this.require(id);
    this.assertNotClosed(fair);
    const name = data.name?.trim() ?? '';
    if (!name) throw new BadRequestException('El nombre es obligatorio');
    const amount = Number(data.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('El monto debe ser mayor a cero');
    }
    const now = new Date().toISOString();
    return this.expenses.create({
      id: this.expenses.nextId(),
      direction: TreasuryMovementDirection.EXPENSE,
      category: TreasuryExpenseCategory.FAIR,
      name,
      quantity: 1,
      unitPrice: amount,
      amount,
      description: fairOriginLabel(fair.name),
      referenceId: fair.id,
      account: data.account ?? TreasuryAccount.CAJA,
      occurredAt: now,
      createdAt: now,
    });
  }

  close(id: string, data: CloseFairDto): Fair {
    const fair = this.require(id);
    if (fair.status === FairStatus.CLOSED) {
      throw new BadRequestException('La feria ya está cerrada');
    }
    if (fair.status !== FairStatus.OPEN) {
      throw new BadRequestException(
        'La feria todavía no se abrió: abrila antes de cerrar la caja',
      );
    }
    const countedCash = Number(data.countedCash);
    if (!Number.isFinite(countedCash) || countedCash < 0) {
      throw new BadRequestException('El efectivo contado no es válido');
    }
    const expectedCash = this.expectedCash(fair);
    const difference = round2(countedCash - expectedCash);
    const reason = data.differenceReason?.trim() ?? '';
    if (difference !== 0 && !reason) {
      throw new BadRequestException(
        'Hay diferencia de caja: indicá el motivo para cerrar',
      );
    }

    const now = new Date().toISOString();
    if (difference !== 0) {
      // Solo la diferencia toca la Billetera; las ventas ya entraron al cobrarse.
      const amount = Math.abs(difference);
      this.expenses.create({
        id: this.expenses.nextId(),
        direction:
          difference > 0
            ? TreasuryMovementDirection.INCOME
            : TreasuryMovementDirection.EXPENSE,
        category: TreasuryExpenseCategory.FAIR,
        name: `Diferencia de caja · ${fair.name}`,
        quantity: 1,
        unitPrice: amount,
        amount,
        description: reason.slice(0, 255),
        referenceId: fairDifferenceRef(fair.id),
        account: TreasuryAccount.CAJA,
        occurredAt: now,
        createdAt: now,
      });
    }

    return this.fairs.save({
      ...fair,
      status: FairStatus.CLOSED,
      closedAt: now,
      countedCash: round2(countedCash),
      cashDifference: difference,
      differenceReason: difference !== 0 ? reason.slice(0, 255) : null,
      updatedAt: now,
    });
  }

  remove(id: string): void {
    const fair = this.require(id);
    if (this.salesOf(id).length) {
      throw new BadRequestException(
        'La feria tiene ventas: no se puede borrar',
      );
    }
    const hasMovements = this.expenses
      .findAll()
      .some(
        (expense) =>
          expense.referenceId === id ||
          expense.referenceId === fairDifferenceRef(id),
      );
    if (hasMovements) {
      throw new BadRequestException(
        'La feria tiene gastos o movimientos de caja: no se puede borrar',
      );
    }
    this.fairs.remove(fair.id);
  }

  /** «Qué llevar» según las últimas 3 ferias cerradas con el mismo nombre. */
  plan(nameRaw?: string): FairPlan {
    const name = normalizeFairName(nameRaw ?? '');
    if (!name) {
      throw new BadRequestException('Indicá el nombre de la feria');
    }
    const past = this.fairs
      .findAll()
      .filter(
        (fair) =>
          fair.status === FairStatus.CLOSED &&
          normalizeFairName(fair.name) === name,
      )
      .sort(
        (a, b) =>
          b.date.localeCompare(a.date) ||
          (b.closedAt ?? '').localeCompare(a.closedAt ?? ''),
      )
      .slice(0, PLAN_FAIRS);
    if (!past.length) return { basedOn: 0, items: [] };

    const pastIds = new Set(past.map((fair) => fair.id));
    const units = new Map<string, { name: string; quantity: number }>();
    for (const sale of this.retailSales.findAll()) {
      if (!sale.fairId || !pastIds.has(sale.fairId)) continue;
      for (const item of sale.items) {
        if (!item.productId) continue;
        const current = units.get(item.productId) ?? {
          name: item.productName,
          quantity: 0,
        };
        current.quantity += item.quantity;
        units.set(item.productId, current);
      }
    }

    const items: FairPlanItem[] = [];
    for (const [productId, value] of units) {
      const average = value.quantity / past.length;
      const take = unitsToTake(average);
      if (take <= 0) continue;
      const product = this.products.findById(productId);
      const stock = product?.stock ?? 0;
      items.push({
        productId,
        name: product?.name ?? value.name,
        average: round2(average),
        stock,
        take,
        toPrint: unitsToPrint(take, stock),
      });
    }
    items.sort((a, b) => b.take - a.take || a.name.localeCompare(b.name, 'es'));
    return { basedOn: past.length, items };
  }

  private require(id: string): Fair {
    const fair = this.fairs.findById(id);
    if (!fair) throw new NotFoundException(`Feria ${id} no encontrada`);
    return fair;
  }

  private assertNotClosed(fair: Fair): void {
    if (fair.status === FairStatus.CLOSED) {
      throw new BadRequestException(
        'La feria está cerrada y no se puede editar',
      );
    }
  }

  private parseName(value: string | undefined): string {
    const name = value?.trim() ?? '';
    if (!name) throw new BadRequestException('El nombre es obligatorio');
    return name;
  }

  private assertValidDate(value: string): void {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
    const valid =
      !!match &&
      (() => {
        const [y, m, d] = [
          Number(match[1]),
          Number(match[2]),
          Number(match[3]),
        ];
        const date = new Date(Date.UTC(y, m - 1, d));
        return (
          date.getUTCFullYear() === y &&
          date.getUTCMonth() === m - 1 &&
          date.getUTCDate() === d
        );
      })();
    if (!valid) {
      throw new BadRequestException(
        'La fecha no es válida. Usá el formato AAAA-MM-DD',
      );
    }
  }

  private parseCalendarEntryId(value: string | undefined): string | null {
    const id = value?.trim();
    if (!id) return null;
    if (!this.store.getCalendarEntryById(id)) {
      throw new BadRequestException('El evento de calendario no existe');
    }
    return id;
  }

  private salesOf(fairId: string): RetailSale[] {
    return this.retailSales.findAll().filter((sale) => sale.fairId === fairId);
  }

  /** Gastos de la feria: egresos no anulados (la diferencia de caja no cuenta). */
  private expensesOf(fairId: string): TreasuryExpense[] {
    return this.expenses
      .findAll()
      .filter(
        (expense) =>
          expense.referenceId === fairId &&
          expense.direction === TreasuryMovementDirection.EXPENSE &&
          !expense.voidedAt,
      )
      .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  }

  private expectedCash(fair: Fair): number {
    const cashSales = this.salesOf(fair.id)
      .filter(
        (sale) =>
          (sale.method ?? PaymentMethod.EFECTIVO) === PaymentMethod.EFECTIVO,
      )
      .reduce((sum, sale) => sum + sale.total, 0);
    return round2(fair.openingFloat + cashSales);
  }

  /** Costo por venta, con el mismo cálculo que SalesService.listEntries. */
  private costBySaleId(): Map<string, number> {
    const map = new Map<string, number>();
    for (const entry of this.sales.listEntries()) {
      if (entry.retailSaleId) map.set(entry.retailSaleId, entry.cost);
    }
    return map;
  }

  private summarize(fair: Fair, costBySale: Map<string, number>): FairSummary {
    const fairSales = this.salesOf(fair.id);
    const sold = round2(fairSales.reduce((sum, sale) => sum + sale.total, 0));
    const cost = round2(
      fairSales.reduce((sum, sale) => sum + (costBySale.get(sale.id) ?? 0), 0),
    );
    const expenses = round2(
      this.expensesOf(fair.id).reduce((sum, e) => sum + e.amount, 0),
    );
    return {
      ...fair,
      salesCount: fairSales.length,
      sold,
      cost,
      expenses,
      result: round2(sold - cost - expenses),
    };
  }
}
