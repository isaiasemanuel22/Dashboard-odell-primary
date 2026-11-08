import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { AdjustSpoolDto, MoveSpoolDto, OpenSpoolDto } from '../common/dto';
import {
  ConsumedSpoolLine,
  PrintJob,
  Spool,
  SpoolLocation,
  Supply,
} from '../common/interfaces';
import { MachineProfileRole, PrintJobStatus } from '../common/enums';
import { ensureMachineProfiles } from '../settings/machine-profile.util';
import { StoreChangeService } from '../store/store-change.service';
import { StoreService } from '../store/store.service';
import {
  applyStockChangeGrams,
  roundRemainingGrams,
} from '../supplies/apply-stock-change.util';
import {
  formatOpenSpoolsLabel,
  resolveSpoolGrams,
  supplyQuantityToGrams,
} from '../supplies/supply-units.util';
import { SuppliesReorderService } from '../supplies/supplies-reorder.service';
import { OrderTasksService } from '../print-jobs/order-tasks.service';
import { AllocateResult, allocateSpools } from './spool-allocate.util';

@Injectable()
export class SpoolsService {
  constructor(
    private readonly store: StoreService,
    private readonly storeChange: StoreChangeService,
    private readonly reorder: SuppliesReorderService,
    @Inject(forwardRef(() => OrderTasksService))
    private readonly orderTasks: OrderTasksService,
  ) {}

  findAll(
    filters: {
      open?: boolean;
      supplyId?: string;
      printerId?: string;
    } = {},
  ): Spool[] {
    const openFilter = filters.open;
    return this.store.spools.filter((spool) => {
      if (openFilter === true && spool.finishedAt) return false;
      if (openFilter === false && !spool.finishedAt) return false;
      if (filters.supplyId && spool.supplyId !== filters.supplyId) return false;
      if (filters.printerId) {
        if (
          spool.location.kind !== 'printer' ||
          spool.location.printerId !== filters.printerId
        ) {
          return false;
        }
      }
      return true;
    });
  }

  findOne(id: string): Spool {
    const spool = this.store.getSpoolById(id);
    if (!spool) {
      throw new NotFoundException(`Bobina ${id} no encontrada`);
    }
    return spool;
  }

  open(data: OpenSpoolDto): Spool {
    const supply = this.requireSupply(data.supplyId);
    const location = this.normalizeLocation(data.location);
    this.assertPrinterSlotFree(location);

    const grams =
      data.grams !== undefined && Number(data.grams) > 0
        ? Number(data.grams)
        : resolveSpoolGrams(supply);

    const openGrams = this.openRemainingGrams(supply.id);
    const stockGrams = supplyQuantityToGrams(supply);
    if (openGrams + grams > stockGrams + 1e-6) {
      throw new BadRequestException(
        'No hay stock cerrado suficiente para abrir otra bobina',
      );
    }

    const now = new Date().toISOString();
    const roundedGrams = roundRemainingGrams(grams);
    const spool: Spool = {
      id: this.store.nextSpoolId(),
      code: this.store.nextSpoolCode(),
      supplyId: supply.id,
      initialGrams: roundedGrams,
      remainingGrams: roundedGrams,
      location,
      openedAt: now,
      finishedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.store.spools.push(spool);
    this.storeChange.recordChange({
      collections: ['spools'],
      realtime: {
        scopes: ['supplies', 'print-jobs', 'dashboard'],
        action: 'create',
        entity: 'spool',
        id: spool.id,
      },
    });
    return spool;
  }

  move(id: string, data: MoveSpoolDto): Spool {
    const spool = this.findOne(id);
    if (spool.finishedAt) {
      throw new BadRequestException('No se puede mover una bobina terminada');
    }
    const location = this.normalizeLocation(data.location);
    this.assertPrinterSlotFree(location, spool.id);
    spool.location = location;
    spool.updatedAt = new Date().toISOString();
    this.storeChange.recordChange({
      collections: ['spools'],
      realtime: {
        scopes: ['supplies', 'print-jobs', 'dashboard'],
        action: 'update',
        entity: 'spool',
        id: spool.id,
      },
    });
    return spool;
  }

  adjust(id: string, data: AdjustSpoolDto): Spool {
    const spool = this.findOne(id);
    if (spool.finishedAt) {
      throw new BadRequestException('No se puede ajustar una bobina terminada');
    }
    const rawNext = Number(data.remainingGrams);
    if (!Number.isFinite(rawNext) || rawNext < 0) {
      throw new BadRequestException('remainingGrams inválido');
    }
    const next = roundRemainingGrams(rawNext);
    const previous = Number(spool.remainingGrams);
    const diffGrams = next - previous;
    spool.remainingGrams = next;
    spool.updatedAt = new Date().toISOString();

    const supply = this.requireSupply(spool.supplyId);
    if (Math.abs(diffGrams) > 1e-9) {
      applyStockChangeGrams(this.store, supply, diffGrams, 'adjust', {
        spoolId: spool.id,
      });
    }

    if (next <= 1e-9) {
      spool.remainingGrams = 0;
      spool.finishedAt = spool.updatedAt;
    }

    this.storeChange.recordChange({
      collections: ['spools', 'supplies', 'supplyMovements'],
      realtime: {
        scopes: ['supplies', 'print-jobs', 'dashboard'],
        action: 'update',
        entity: 'spool',
        id: spool.id,
      },
    });
    return spool;
  }

  finish(id: string): Spool {
    const spool = this.findOne(id);
    if (spool.finishedAt) {
      return spool;
    }
    const remaining = Number(spool.remainingGrams);
    const now = new Date().toISOString();
    const supply = this.requireSupply(spool.supplyId);

    // Remanente > 0 se considera descartado (movimiento adjust negativo).
    if (remaining > 1e-9) {
      applyStockChangeGrams(this.store, supply, -remaining, 'adjust', {
        spoolId: spool.id,
      });
    }

    spool.remainingGrams = 0;
    spool.finishedAt = now;
    spool.updatedAt = now;

    this.storeChange.recordChange({
      collections: ['spools', 'supplies', 'supplyMovements'],
      realtime: {
        scopes: ['supplies', 'print-jobs', 'dashboard'],
        action: 'update',
        entity: 'spool',
        id: spool.id,
      },
    });
    return spool;
  }

  /**
   * Reparte gramos entre bobinas (impresora primero, luego menor remanente).
   * Si dryRun=false, descuenta remainingGrams y aplica movimientos.
   */
  allocate(
    supply: Supply,
    grams: number,
    job: Pick<PrintJob, 'id' | 'printerId'>,
    options: { dryRun?: boolean; reason?: 'task' | 'failure' } = {},
  ): AllocateResult & { consumed: ConsumedSpoolLine[] } {
    const dryRun = options.dryRun === true;
    const reason = options.reason ?? 'task';
    const open = this.store.spools.filter(
      (s) => s.supplyId === supply.id && !s.finishedAt,
    );
    // Copia superficial para dryRun sin mutar.
    const working: Spool[] = dryRun
      ? open.map((s) => ({
          ...s,
          location: { ...s.location },
        }))
      : open;

    const result = allocateSpools(working, grams, job.printerId);
    const consumed: ConsumedSpoolLine[] = result.spools.map((p) => ({
      spoolId: p.spoolId,
      code: p.code,
      grams: p.grams,
    }));

    if (dryRun) {
      return { ...result, consumed };
    }

    const now = new Date().toISOString();
    for (const portion of result.spools) {
      const spool = this.store.getSpoolById(portion.spoolId);
      if (!spool) continue;
      spool.remainingGrams = roundRemainingGrams(portion.remainingAfter);
      spool.updatedAt = now;
      if (portion.remainingAfter <= 1e-9) {
        spool.remainingGrams = 0;
        spool.finishedAt = now;
      }
      applyStockChangeGrams(this.store, supply, -portion.grams, reason, {
        jobId: job.id,
        spoolId: spool.id,
      });
    }
    if (result.closedGrams > 1e-9) {
      applyStockChangeGrams(this.store, supply, -result.closedGrams, reason, {
        jobId: job.id,
      });
    }

    return { ...result, consumed };
  }

  /** Valida que el stock manual no quede por debajo de bobinas abiertas. */
  assertStockCoversOpenSpools(supply: Supply, nextQuantity: number): void {
    const openGrams = this.openRemainingGrams(supply.id);
    if (openGrams <= 1e-9) return;
    const nextGrams = supplyQuantityToGrams({
      ...supply,
      quantity: nextQuantity,
    });
    if (nextGrams + 1e-6 < openGrams) {
      throw new BadRequestException(
        `Hay ${formatOpenSpoolsLabel(supply, openGrams)} en bobinas abiertas de este insumo`,
      );
    }
  }

  getAlerts(now = new Date()) {
    const spoolShort: Array<{
      kind: 'spool_short';
      printerId: string;
      printerName: string;
      slot: number;
      spoolId: string;
      code: string;
      needGrams: number;
      remainingGrams: number;
      jobId: string;
      jobName: string;
    }> = [];

    const profiles = ensureMachineProfiles(this.store.generalSettings).filter(
      (p) => p.role === MachineProfileRole.PRINT && p.queueEnabled,
    );

    for (const profile of profiles) {
      const nextJob = this.nextQueueJob(profile.id);
      if (!nextJob) continue;

      const lines = this.orderTasks.describeConsumption(nextJob);
      for (const line of lines) {
        if (!line.supplyId || !(line.quantity > 0)) continue;
        const supply = this.store.getSupplyById(line.supplyId);
        if (!supply) continue;

        const needGrams = supplyQuantityToGrams({
          ...supply,
          quantity: line.quantity,
        });
        // Bobina del mismo supply en esta impresora.
        const onPrinter = this.store.spools.find(
          (s) =>
            !s.finishedAt &&
            s.supplyId === supply.id &&
            s.location.kind === 'printer' &&
            s.location.printerId === profile.id,
        );
        if (!onPrinter || onPrinter.location.kind !== 'printer') continue;
        if (Number(onPrinter.remainingGrams) + 1e-6 >= needGrams) continue;

        spoolShort.push({
          kind: 'spool_short',
          printerId: profile.id,
          printerName: profile.name,
          slot: onPrinter.location.slot,
          spoolId: onPrinter.id,
          code: onPrinter.code,
          needGrams,
          remainingGrams: Number(onPrinter.remainingGrams),
          jobId: nextJob.id,
          jobName: nextJob.productName,
        });
      }
    }

    const reorder = this.reorder
      .computeRows(now)
      .filter((r) => r.status === 'urgent')
      .map((r) => ({
        kind: 'reorder' as const,
        supplyId: r.supplyId,
        name: r.name,
        orderBy: r.orderBy,
        coversDays: r.coversDays,
        stock: r.stock,
        unit: r.unit,
        stockLabel: `${r.stock} ${r.unit}`,
        supplierName: r.supplier?.name ?? null,
        leadTimeBusinessDays: r.supplier?.leadTimeBusinessDays ?? null,
        reason: r.reason,
      }));

    return [...spoolShort, ...reorder];
  }

  private nextQueueJob(printerId: string): PrintJob | undefined {
    const statuses = new Set<string>([
      PrintJobStatus.POR_HACER,
      PrintJobStatus.EN_PROCESO,
      PrintJobStatus.BLOQUEADO,
    ]);
    const jobs = this.store.printJobs
      .filter(
        (job) =>
          !job.archived &&
          job.active &&
          job.printerId === printerId &&
          statuses.has(job.status) &&
          job.status !== PrintJobStatus.TERMINADO,
      )
      .sort((a, b) => {
        if (a.status === PrintJobStatus.EN_PROCESO) return -1;
        if (b.status === PrintJobStatus.EN_PROCESO) return 1;
        return (a.queuePosition ?? 9999) - (b.queuePosition ?? 9999);
      });
    return jobs.find((j) => j.status !== PrintJobStatus.TERMINADO);
  }

  private openRemainingGrams(supplyId: string): number {
    return this.store.spools
      .filter((s) => s.supplyId === supplyId && !s.finishedAt)
      .reduce((sum, s) => sum + Number(s.remainingGrams), 0);
  }

  private requireSupply(id: string): Supply {
    const supply = this.store.getSupplyById(id);
    if (!supply) {
      throw new NotFoundException(`Insumo ${id} no encontrado`);
    }
    return supply;
  }

  private normalizeLocation(
    raw: SpoolLocation | OpenSpoolDto['location'],
  ): SpoolLocation {
    if (!raw || typeof raw !== 'object' || !('kind' in raw)) {
      throw new BadRequestException('location inválida');
    }
    if (raw.kind === 'printer') {
      const printerId = String(raw.printerId || '').trim();
      const slot = Number(raw.slot);
      if (!printerId || !Number.isInteger(slot) || slot < 1 || slot > 4) {
        throw new BadRequestException(
          'location de impresora requiere printerId y slot 1..4',
        );
      }
      const profiles = ensureMachineProfiles(this.store.generalSettings);
      if (!profiles.some((p) => p.id === printerId)) {
        throw new BadRequestException(`Impresora ${printerId} no encontrada`);
      }
      return { kind: 'printer', printerId, slot };
    }
    if (raw.kind === 'shelf') {
      const text = String(raw.text || '').trim() || 'Sin ubicar';
      return { kind: 'shelf', text };
    }
    throw new BadRequestException('location inválida');
  }

  private assertPrinterSlotFree(
    location: SpoolLocation,
    excludeSpoolId?: string,
  ): void {
    if (location.kind !== 'printer') return;
    const occupant = this.store.spools.find(
      (s) =>
        !s.finishedAt &&
        s.id !== excludeSpoolId &&
        s.location.kind === 'printer' &&
        s.location.printerId === location.printerId &&
        s.location.slot === location.slot,
    );
    if (occupant) {
      throw new BadRequestException(
        `La ranura ${location.slot} de la impresora ya tiene la bobina ${occupant.code}`,
      );
    }
  }
}
