import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CreateTreasuryExpenseDto,
  TreasurySupplyLineDto,
  UpdateTreasuryExpenseDto,
} from '../common/dto';
import {
  SupplyCategory,
  TreasuryExpenseCategory,
  TreasuryMovementDirection,
} from '../common/enums';
import {
  Supply,
  TreasuryExpense,
  TreasuryOverview,
} from '../common/interfaces';
import { SalesService } from '../sales/sales.service';
import { SuppliesService } from '../supplies/supplies.service';
import { StoreChangeService } from '../store/store-change.service';
import {
  SupplyRepository,
  TreasuryExpenseRepository,
} from '../store/repositories';
import {
  computeDebtorBalances,
  getDebtorOutstanding,
} from './treasury-debtor.util';
import { toCents } from '../common/utils/money.util';

interface ValidatedSupplyPurchaseLine {
  supply: Supply;
  quantity: number;
  amountSpent: number;
  unitPrice: number;
}

@Injectable()
export class TreasuryService {
  constructor(
    private readonly sales: SalesService,
    private readonly expenses: TreasuryExpenseRepository,
    private readonly supplies: SupplyRepository,
    private readonly suppliesService: SuppliesService,
    private readonly storeChange: StoreChangeService,
  ) {}

  getOverview(): TreasuryOverview {
    // Caja operativa: lo cobrado (mostrador + pagos/señas), no el total al entregar.
    const totalSalesIncome = this.sales.getCollectedIncome();
    const records = this.listRecords();
    const totalManualIncome = records
      .filter((record) => record.direction === TreasuryMovementDirection.INCOME)
      .reduce((sum, record) => sum + record.amount, 0);
    const totalExpenses = records
      .filter(
        (record) => record.direction === TreasuryMovementDirection.EXPENSE,
      )
      .reduce((sum, record) => sum + record.amount, 0);

    return {
      availableBalance: totalSalesIncome + totalManualIncome - totalExpenses,
      totalIncome: totalSalesIncome + totalManualIncome,
      totalExpenses,
      totalSalesIncome,
      totalManualIncome,
      expenses: records,
      recordNameSuggestions: this.listRecordNameSuggestions(),
      recipientNameSuggestions: this.listRecipientNameSuggestions(),
      debtors: computeDebtorBalances(records),
    };
  }

  getAvailableBalance(): number {
    return this.getOverview().availableBalance;
  }

  listRecords(): TreasuryExpense[] {
    return [...this.expenses.findAll()].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  listRecordNameSuggestions(): string[] {
    const names = new Set<string>();
    for (const record of this.expenses.findAll()) {
      if (record.category !== TreasuryExpenseCategory.OTHER) continue;
      const name = record.name.trim();
      if (name) names.add(name);
    }
    return [...names].sort((a, b) => a.localeCompare(b, 'es'));
  }

  listRecipientNameSuggestions(): string[] {
    const names = new Set<string>();
    for (const record of this.expenses.findAll()) {
      if (
        record.category !== TreasuryExpenseCategory.PAYMENT &&
        record.category !== TreasuryExpenseCategory.LOAN
      ) {
        continue;
      }
      const name = record.name.trim();
      if (name) names.add(name);
    }
    return [...names].sort((a, b) => a.localeCompare(b, 'es'));
  }

  recordExpense(data: CreateTreasuryExpenseDto): TreasuryExpense[] {
    const occurredAt = this.parseOccurredAt(data.occurredAt);

    if (data.isSupplyPurchase) {
      return this.recordSupplyPurchaseExpense(data, occurredAt);
    }

    if (
      data.category === TreasuryExpenseCategory.PAYMENT ||
      data.category === TreasuryExpenseCategory.LOAN
    ) {
      return [this.recordPersonMovement(data, occurredAt)];
    }

    if (data.category === TreasuryExpenseCategory.LOAN_REPAYMENT) {
      return [this.recordLoanRepayment(data, occurredAt)];
    }

    return [this.recordSimpleMovement(data, occurredAt)];
  }

  updateExpense(id: string, data: UpdateTreasuryExpenseDto): TreasuryExpense {
    const current = this.requireRecord(id);
    const occurredAt = data.occurredAt
      ? this.parseOccurredAt(data.occurredAt)
      : current.occurredAt;

    if (current.category === TreasuryExpenseCategory.SUPPLY_PURCHASE) {
      return this.updateSupplyPurchase(current, data, occurredAt);
    }

    if (
      current.category === TreasuryExpenseCategory.PAYMENT ||
      current.category === TreasuryExpenseCategory.LOAN
    ) {
      return this.updatePersonMovement(current, data, occurredAt);
    }

    if (current.category === TreasuryExpenseCategory.LOAN_REPAYMENT) {
      return this.updateLoanRepayment(current, data, occurredAt);
    }

    return this.updateSimpleMovement(current, data, occurredAt);
  }

  removeExpense(id: string): void {
    const current = this.requireRecord(id);
    const supplyId = this.linkedSupplyId(current);
    if (supplyId) {
      this.syncSupplyStock(supplyId, -Number(current.quantity));
    }

    if (!this.expenses.remove(id)) {
      throw new NotFoundException('Registro no encontrado');
    }

    this.persistRecords(!!supplyId, 'delete');
  }

  private updateSimpleMovement(
    current: TreasuryExpense,
    data: UpdateTreasuryExpenseDto,
    occurredAt: string,
  ): TreasuryExpense {
    const name = (data.name ?? current.name).trim();
    if (!name) {
      throw new BadRequestException('El nombre es obligatorio');
    }

    const amount = this.parsePositiveAmount(data.amount ?? current.amount);
    const direction =
      data.direction === TreasuryMovementDirection.INCOME
        ? TreasuryMovementDirection.INCOME
        : data.direction === TreasuryMovementDirection.EXPENSE
          ? TreasuryMovementDirection.EXPENSE
          : current.direction;

    return this.replaceRecord(
      {
        ...current,
        direction,
        name,
        quantity: 1,
        unitPrice: amount,
        amount,
        occurredAt,
      },
      false,
    );
  }

  private updatePersonMovement(
    current: TreasuryExpense,
    data: UpdateTreasuryExpenseDto,
    occurredAt: string,
  ): TreasuryExpense {
    const name = (data.name ?? current.name).trim();
    if (!name) {
      throw new BadRequestException('Ingresá la persona destinataria');
    }

    const amount = this.parsePositiveAmount(data.amount ?? current.amount);
    const description =
      current.category === TreasuryExpenseCategory.PAYMENT
        ? `Pago a ${name}`
        : `Préstamo a ${name}`;

    return this.replaceRecord(
      {
        ...current,
        name,
        quantity: 1,
        unitPrice: amount,
        amount,
        description,
        occurredAt,
      },
      false,
    );
  }

  private updateLoanRepayment(
    current: TreasuryExpense,
    data: UpdateTreasuryExpenseDto,
    occurredAt: string,
  ): TreasuryExpense {
    const name = (data.name ?? current.name).trim();
    if (!name) {
      throw new BadRequestException('Ingresá la persona que devuelve');
    }

    const amount = this.parsePositiveAmount(data.amount ?? current.amount);
    const outstanding = getDebtorOutstanding(
      this.listRecords().filter((record) => record.id !== current.id),
      name,
    );
    if (outstanding <= 0) {
      throw new BadRequestException('Esta persona no tiene deuda pendiente');
    }
    if (Math.round(amount) > outstanding) {
      throw new BadRequestException(
        `El monto supera la deuda pendiente (${outstanding})`,
      );
    }

    return this.replaceRecord(
      {
        ...current,
        name,
        quantity: 1,
        unitPrice: amount,
        amount,
        description: `Devolución de ${name}`,
        occurredAt,
      },
      false,
    );
  }

  private updateSupplyPurchase(
    current: TreasuryExpense,
    data: UpdateTreasuryExpenseDto,
    occurredAt: string,
  ): TreasuryExpense {
    const amount = this.parsePositiveAmount(data.amount ?? current.amount);
    const quantity = Number(data.quantity ?? current.quantity);
    const unitPrice = Number(data.unitPrice ?? current.unitPrice);
    if (quantity <= 0 || unitPrice < 0) {
      throw new BadRequestException('Revisá cantidad, gasto y valor unitario');
    }

    const supplyId = current.referenceId;
    const supply = supplyId ? this.supplies.findById(supplyId) : undefined;
    const name = supply?.name ?? (data.name ?? current.name).trim();
    if (!name) {
      throw new BadRequestException('El nombre es obligatorio');
    }

    const quantityChanged =
      Math.abs(quantity - Number(current.quantity)) > 1e-9;
    const priceChanged =
      Math.round(unitPrice) !== Math.round(Number(current.unitPrice));

    if (supplyId && !supply && (quantityChanged || priceChanged)) {
      throw new BadRequestException(
        'El insumo de esta compra ya no existe. Podés eliminarla o cambiar solo el monto y la fecha.',
      );
    }

    if (supply && (quantityChanged || priceChanged)) {
      this.syncSupplyStock(
        supply.id,
        quantity - Number(current.quantity),
        priceChanged ? unitPrice : undefined,
      );
    }

    return this.replaceRecord(
      {
        ...current,
        name,
        quantity,
        unitPrice,
        amount,
        description: supply
          ? this.purchaseDescription(supply)
          : current.description,
        occurredAt,
      },
      !!supply && (quantityChanged || priceChanged),
    );
  }

  private recordLoanRepayment(
    data: CreateTreasuryExpenseDto,
    occurredAt: string,
  ): TreasuryExpense {
    const name = data.name?.trim() ?? '';
    if (!name) {
      throw new BadRequestException('Ingresá la persona que devuelve');
    }

    const amount = Number(data.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('El monto debe ser mayor a cero');
    }

    const outstanding = getDebtorOutstanding(this.listRecords(), name);
    if (outstanding <= 0) {
      throw new BadRequestException('Esta persona no tiene deuda pendiente');
    }
    if (Math.round(amount) > outstanding) {
      throw new BadRequestException(
        `El monto supera la deuda pendiente (${outstanding})`,
      );
    }

    return this.createRecord(
      {
        direction: TreasuryMovementDirection.INCOME,
        category: TreasuryExpenseCategory.LOAN_REPAYMENT,
        name,
        quantity: 1,
        unitPrice: amount,
        amount,
        description: `Devolución de ${name}`,
      },
      occurredAt,
    );
  }

  private recordPersonMovement(
    data: CreateTreasuryExpenseDto,
    occurredAt: string,
  ): TreasuryExpense {
    const name = data.name?.trim() ?? '';
    if (!name) {
      throw new BadRequestException('Ingresá la persona destinataria');
    }

    const category = data.category;
    if (
      category !== TreasuryExpenseCategory.PAYMENT &&
      category !== TreasuryExpenseCategory.LOAN
    ) {
      throw new BadRequestException('Categoría de movimiento inválida');
    }

    const amount = Number(data.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('El monto debe ser mayor a cero');
    }

    const description =
      category === TreasuryExpenseCategory.PAYMENT
        ? `Pago a ${name}`
        : `Préstamo a ${name}`;

    return this.createRecord(
      {
        direction: TreasuryMovementDirection.EXPENSE,
        category,
        name,
        quantity: 1,
        unitPrice: amount,
        amount,
        description,
      },
      occurredAt,
    );
  }

  private recordSimpleMovement(
    data: CreateTreasuryExpenseDto,
    occurredAt: string,
  ): TreasuryExpense {
    const name = data.name?.trim() ?? '';
    if (!name) {
      throw new BadRequestException('El nombre es obligatorio');
    }

    const amount = Number(data.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('El monto debe ser mayor a cero');
    }

    const direction =
      data.direction === TreasuryMovementDirection.INCOME
        ? TreasuryMovementDirection.INCOME
        : TreasuryMovementDirection.EXPENSE;

    return this.createRecord(
      {
        direction,
        category: TreasuryExpenseCategory.OTHER,
        name,
        quantity: 1,
        unitPrice: amount,
        amount,
      },
      occurredAt,
    );
  }

  private recordSupplyPurchaseExpense(
    data: CreateTreasuryExpenseDto,
    occurredAt: string,
  ): TreasuryExpense[] {
    const validatedLines = this.validateSupplyPurchaseLines(
      data.supplyLines ?? [],
      Number(data.amount),
    );

    const created = validatedLines.map((line) =>
      this.createRecord(
        {
          direction: TreasuryMovementDirection.EXPENSE,
          category: TreasuryExpenseCategory.SUPPLY_PURCHASE,
          name: line.supply.name,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          amount: line.amountSpent,
          description: this.purchaseDescription(line.supply),
          referenceId: line.supply.id,
        },
        occurredAt,
        { persist: false },
      ),
    );

    for (const line of validatedLines) {
      this.suppliesService.recordPurchase(
        line.supply.id,
        {
          quantityDelta: line.quantity,
          unitPrice: line.unitPrice,
        },
        { persist: false, notify: false },
      );
    }

    this.storeChange.recordChange({
      collections: ['treasuryExpenses', 'supplies'],
      realtime: {
        scopes: ['dashboard', 'supplies', 'print-jobs'],
        action: 'update',
        entity: 'supply',
      },
    });
    this.suppliesService.notifySupplyAvailability();

    return created;
  }

  private validateSupplyPurchaseLines(
    lines: TreasurySupplyLineDto[],
    totalAmount: number,
  ): ValidatedSupplyPurchaseLine[] {
    if (!lines.length) {
      throw new BadRequestException('Agregá al menos un insumo');
    }

    const totalSpentCents = lines.reduce(
      (sum, line) => sum + toCents(line.amountSpent),
      0,
    );
    if (totalSpentCents !== toCents(totalAmount)) {
      throw new BadRequestException(
        'El monto total no coincide con la suma de gastos por insumo',
      );
    }

    return lines.map((line) => {
      const supply = this.supplies.findById(line.supplyId);
      if (!supply) {
        throw new NotFoundException(`Insumo ${line.supplyId} no encontrado`);
      }

      const quantity = Number(line.quantity);
      const amountSpent = Number(line.amountSpent);
      const unitPrice = Number(line.unitPrice);

      if (quantity <= 0 || amountSpent <= 0 || unitPrice < 0) {
        throw new BadRequestException(
          'Revisá cantidad, gasto y valor unitario',
        );
      }

      return {
        supply,
        quantity,
        amountSpent,
        unitPrice,
      };
    });
  }

  private purchaseDescription(supply: Supply): string {
    const kind =
      supply.category === SupplyCategory.FDM ||
      supply.category === SupplyCategory.RESINA
        ? 'material'
        : 'insumo';
    return `Compra de ${kind}: ${supply.name}`;
  }

  private parseOccurredAt(value: string): string {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
    if (!match) {
      throw new BadRequestException(
        'La fecha no es válida. Usá el formato AAAA-MM-DD',
      );
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const parsed = new Date(year, month - 1, day, 12, 0, 0, 0);

    if (
      parsed.getFullYear() !== year ||
      parsed.getMonth() !== month - 1 ||
      parsed.getDate() !== day
    ) {
      throw new BadRequestException(
        'La fecha no es válida. Usá el formato AAAA-MM-DD',
      );
    }

    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (parsed.getTime() > today.getTime()) {
      throw new BadRequestException('La fecha no puede ser posterior a hoy');
    }

    return parsed.toISOString();
  }

  private requireRecord(id: string): TreasuryExpense {
    const record = this.expenses.findById(id);
    if (!record) {
      throw new NotFoundException('Registro no encontrado');
    }
    return record;
  }

  private linkedSupplyId(record: TreasuryExpense): string | null {
    if (record.category !== TreasuryExpenseCategory.SUPPLY_PURCHASE) {
      return null;
    }
    if (!record.referenceId || !this.supplies.findById(record.referenceId)) {
      return null;
    }
    return record.referenceId;
  }

  private parsePositiveAmount(value: number): number {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('El monto debe ser mayor a cero');
    }
    return amount;
  }

  /**
   * El alta de una compra suma stock. Editar aplica la diferencia y borrar
   * resta la cantidad anterior, para que el stock quede igual al movimiento.
   */
  private syncSupplyStock(
    supplyId: string,
    quantityDelta: number,
    unitPrice?: number,
  ): void {
    const supply = this.supplies.findById(supplyId);
    if (!supply) {
      throw new NotFoundException(`Insumo ${supplyId} no encontrado`);
    }

    const nextQuantity = Number(supply.quantity) + Number(quantityDelta);
    if (nextQuantity < -1e-6) {
      throw new BadRequestException(
        'El stock del insumo no alcanza para revertir esta compra',
      );
    }

    const price = unitPrice !== undefined ? Number(unitPrice) : undefined;
    const unitPriceChanged =
      price !== undefined &&
      Math.round(price) !== Math.round(Number(supply.unitPrice));

    this.supplies.save({
      ...supply,
      quantity: nextQuantity < 1e-6 ? 0 : nextQuantity,
      ...(unitPriceChanged
        ? { unitPrice: price, priceFromSettings: false }
        : {}),
      updatedAt: new Date().toISOString(),
    });
  }

  private replaceRecord(
    expense: TreasuryExpense,
    suppliesChanged: boolean,
  ): TreasuryExpense {
    const saved = this.expenses.save(expense);
    this.persistRecords(suppliesChanged, 'update');
    return saved;
  }

  private persistRecords(
    suppliesChanged: boolean,
    action: 'update' | 'delete',
  ): void {
    this.storeChange.recordChange({
      collections: suppliesChanged
        ? ['treasuryExpenses', 'supplies']
        : ['treasuryExpenses'],
      realtime: {
        scopes: suppliesChanged
          ? ['dashboard', 'supplies', 'print-jobs']
          : ['dashboard'],
        action,
        entity: suppliesChanged ? 'supply' : 'settings',
      },
    });
    if (suppliesChanged) {
      this.suppliesService.notifySupplyAvailability();
    }
  }

  private createRecord(
    data: Omit<TreasuryExpense, 'id' | 'occurredAt' | 'createdAt'>,
    occurredAt: string,
    options: { persist?: boolean } = {},
  ): TreasuryExpense {
    const persist = options.persist !== false;
    const now = new Date().toISOString();
    const expense = this.expenses.create({
      id: this.expenses.nextId(),
      ...data,
      occurredAt,
      createdAt: now,
    });

    if (persist) {
      this.storeChange.recordChange({
        collections: ['treasuryExpenses'],
        realtime: {
          scopes: ['dashboard'],
          action: 'update',
          entity: 'settings',
        },
      });
    }

    return expense;
  }
}
