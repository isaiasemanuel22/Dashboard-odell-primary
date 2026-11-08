import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateSupplierDto, UpdateSupplierDto } from '../common/dto';
import { Supplier } from '../common/interfaces';
import { StoreChangeService } from '../store/store-change.service';
import { StoreService } from '../store/store.service';
import { syncSupplySupplierText } from '../supplies/supplier-migration.util';
import {
  arTodayKey,
  businessDaysToCalendarDays,
} from '../supplies/business-days.util';
import { SuppliesReorderService } from '../supplies/supplies-reorder.service';

@Injectable()
export class SuppliersService {
  constructor(
    private readonly store: StoreService,
    private readonly storeChange: StoreChangeService,
    private readonly reorder: SuppliesReorderService,
  ) {}

  findAll(): Supplier[] {
    return [...this.store.suppliers].sort((a, b) =>
      a.name.localeCompare(b.name, 'es'),
    );
  }

  findOne(id: string): Supplier {
    const supplier = this.store.getSupplierById(id);
    if (!supplier) {
      throw new NotFoundException(`Proveedor ${id} no encontrado`);
    }
    return supplier;
  }

  create(data: CreateSupplierDto): Supplier {
    const name = data.name.trim();
    this.assertUniqueName(name);
    const now = new Date().toISOString();
    const lead = this.normalizeLead(data.leadTimeBusinessDays);
    const supplier: Supplier = {
      id: this.store.nextSupplierId(),
      name,
      leadTimeBusinessDays: lead,
      contact: data.contact?.trim() || undefined,
      notes: data.notes?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    };
    this.store.suppliers.push(supplier);
    this.storeChange.recordChange({
      collections: ['suppliers'],
      realtime: {
        scopes: ['supplies', 'dashboard'],
        action: 'create',
        entity: 'supplier',
        id: supplier.id,
      },
    });
    return supplier;
  }

  update(id: string, data: UpdateSupplierDto): Supplier {
    const existing = this.findOne(id);
    const name = data.name !== undefined ? data.name.trim() : existing.name;
    if (!name) {
      throw new BadRequestException('El nombre es obligatorio');
    }
    if (name.toLowerCase() !== existing.name.toLowerCase()) {
      this.assertUniqueName(name, id);
    }
    const updated: Supplier = {
      ...existing,
      name,
      leadTimeBusinessDays:
        data.leadTimeBusinessDays !== undefined
          ? this.normalizeLead(data.leadTimeBusinessDays)
          : existing.leadTimeBusinessDays,
      contact:
        data.contact !== undefined
          ? data.contact.trim() || undefined
          : existing.contact,
      notes:
        data.notes !== undefined
          ? data.notes.trim() || undefined
          : existing.notes,
      updatedAt: new Date().toISOString(),
    };
    this.store.replaceSupplier(updated);

    for (const supply of this.store.supplies) {
      if (supply.supplierId === id) {
        syncSupplySupplierText(supply, this.store.suppliers);
      }
    }

    this.storeChange.recordChange({
      collections: ['suppliers', 'supplies'],
      realtime: {
        scopes: ['supplies', 'dashboard'],
        action: 'update',
        entity: 'supplier',
        id,
      },
    });
    return updated;
  }

  remove(id: string): void {
    this.findOne(id);
    const used = this.store.supplies.some((s) => s.supplierId === id);
    if (used) {
      throw new BadRequestException(
        'No se puede borrar: hay insumos que usan este proveedor',
      );
    }
    this.store.removeSupplier(id);
    this.storeChange.recordChange({
      collections: ['suppliers'],
      realtime: {
        scopes: ['supplies', 'dashboard'],
        action: 'delete',
        entity: 'supplier',
        id,
      },
    });
  }

  orderDraft(id: string, now = new Date()) {
    const supplier = this.findOne(id);
    const rows = this.reorder
      .computeRows(now)
      .filter(
        (row) => row.supplier?.id === id && Number(row.suggestedQuantity) > 0,
      );

    const lines = rows.map((row) => ({
      name: row.name,
      quantity: row.suggestedQuantity,
      unit: row.unit,
    }));

    const body = lines
      .map((line) => `- ${line.name}: ${line.quantity} ${line.unit}`)
      .join('\n');
    const text = `Hola ${supplier.name}, necesito:\n${body}`;

    return { supplier, lines, text };
  }

  /** Expuesto para tests / reorder summary. */
  leadCalendarDays(leadTimeBusinessDays: number, now = new Date()): number {
    return businessDaysToCalendarDays(arTodayKey(now), leadTimeBusinessDays);
  }

  private assertUniqueName(name: string, excludeId?: string): void {
    const key = name.toLowerCase();
    const clash = this.store.suppliers.find(
      (s) =>
        s.name.trim().toLowerCase() === key &&
        (!excludeId || s.id !== excludeId),
    );
    if (clash) {
      throw new BadRequestException(
        `Ya existe un proveedor con el nombre «${clash.name}»`,
      );
    }
  }

  private normalizeLead(value: number | undefined): number {
    if (value === undefined || value === null) return 3;
    const n = Math.trunc(Number(value));
    if (!Number.isFinite(n) || n < 0 || n > 60) {
      throw new BadRequestException(
        'La demora debe ser un entero entre 0 y 60 días hábiles',
      );
    }
    return n;
  }
}
