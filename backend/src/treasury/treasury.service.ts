import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateTreasuryExpenseDto, TreasurySupplyLineDto } from '../common/dto';
import {
  SupplyCategory,
  TreasuryExpenseCategory,
  TreasuryMovementDirection,
} from '../common/enums';
import { Supply, TreasuryExpense, TreasuryOverview } from '../common/interfaces';
import { SalesService } from '../sales/sales.service';
import { SuppliesService } from '../supplies/supplies.service';
import { StoreChangeService } from '../store/store-change.service';
import { SupplyRepository, TreasuryExpenseRepository } from '../store/repositories';
import { computeDebtorBalances, getDebtorOutstanding } from './treasury-debtor.util';

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
    const totalSalesIncome = this.sales.getTotalIncome();
    const records = this.listRecords();
    const totalManualIncome = records
      .filter((record) => record.direction === TreasuryMovementDirection.INCOME)
      .reduce((sum, record) => sum + record.amount, 0);
    const totalExpenses = records
      .filter((record) => record.direction === TreasuryMovementDirection.EXPENSE)
      .reduce((sum, record) => sum + record.amount, 0);

    return {
      availableBalance:
        totalSalesIncome + totalManualIncome - totalExpenses,
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
      (sum, line) => sum + this.toCents(line.amountSpent),
      0,
    );
    if (totalSpentCents !== this.toCents(totalAmount)) {
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
        throw new BadRequestException('Revisá cantidad, gasto y valor unitario');
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

  private toCents(value: number): number {
    return Math.round(Number(value) * 100);
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
