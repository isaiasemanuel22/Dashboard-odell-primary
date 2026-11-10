import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { findColorById } from '../common/color.util';
import {
  MachineProfileRole,
  PrintJobStatus,
  ProductType,
  ServiceType,
  TaskType,
} from '../common/enums';
import {
  ColorConfig,
  MachineProfile,
  PrintJob,
  PrintJobActor,
} from '../common/interfaces';
import { isDesignPrintConfigured } from '../orders/design-print.util';
import {
  ensureMachineProfiles,
  fdmQueuePrinters,
  resolvePreferredPrinterId,
} from '../settings/machine-profile.util';
import { printerSlotsApi } from '../spools/printer-slots.util';
import { StoreChangeService } from '../store/store-change.service';
import { StoreService } from '../store/store.service';
import { OrderTasksService } from './order-tasks.service';
import {
  PrinterWorkConfig,
  arDateKey,
  buildPrinterSchedule,
  countWorkdaysAhead,
  fromArLocal,
  printerWorkConfig,
  scheduleWorkHours,
  weekdaysMonSat,
  workHoursBetween,
} from './printer-schedule.util';

const QUEUE_STATUSES = new Set<string>([
  PrintJobStatus.POR_HACER,
  PrintJobStatus.EN_PROCESO,
  PrintJobStatus.BLOQUEADO,
]);

export interface AssignPrinterDto {
  /** Id de perfil, null para desasignar, o el literal 'auto'. */
  printerId: string | null;
  position?: number;
}

@Injectable()
export class PrinterQueueService {
  constructor(
    private readonly store: StoreService,
    private readonly orderTasks: OrderTasksService,
    private readonly storeChange?: StoreChangeService,
  ) {}

  getPrinterQueue(now = new Date()) {
    const printers = this.queuePrinters();
    const eligible = this.eligibleJobs();
    const assignedIds = new Set<string>();

    const printerRows = printers.map((profile) => {
      const jobs = this.sortQueueJobs(
        eligible.filter((job) => this.resolvedPrinterId(job) === profile.id),
      );
      for (const job of jobs) assignedIds.add(job.id);

      const config = this.workConfig(profile);
      const schedule = buildPrinterSchedule(
        jobs.map((job) => ({
          jobId: job.id,
          status: job.status,
          estimatedHours: job.estimatedHours,
          dueDate: job.dueDate,
          startedAt: job.startedAt,
        })),
        config,
        now,
      );

      const workdays = countWorkdaysAhead(config, now, 7);
      const capacity = (profile.workHoursPerDay ?? 16) * workdays;
      const loadPct =
        capacity > 0 ? Math.min(1, schedule.queuedHours / capacity) : 0;

      const scheduleById = new Map(
        schedule.jobs.map((item) => [item.jobId, item]),
      );

      return {
        profile: this.serializeProfile(profile),
        busyUntil: schedule.busyUntil,
        queuedHours: schedule.queuedHours,
        printing: schedule.printing,
        loadPct,
        jobs: jobs.map((job) => ({
          ...job,
          colors: this.resolveJobColors(job),
          schedule: scheduleById.get(job.id) ?? null,
        })),
      };
    });

    const unassigned = this.sortQueueJobs(
      eligible.filter((job) => !assignedIds.has(job.id)),
    ).map((job) => ({
      ...job,
      colors: this.resolveJobColors(job),
    }));

    return {
      printers: printerRows,
      unassigned,
      otherAreas: this.otherAreasSummary(),
    };
  }

  deliveryEstimate(hoursInput?: number, now = new Date()) {
    const hours = clampInt(hoursInput, 1, 200, 4);
    const printers = this.queuePrinters();
    if (!printers.length) {
      throw new BadRequestException('No hay impresoras habilitadas en la cola');
    }

    const eligible = this.eligibleJobs();
    let best: {
      date: string;
      printerId: string;
      endMs: number;
      name: string;
    } | null = null;

    for (const profile of printers) {
      const jobs = this.sortQueueJobs(
        eligible.filter((job) => this.resolvedPrinterId(job) === profile.id),
      );
      const config = this.workConfig(profile);
      const schedule = buildPrinterSchedule(
        jobs.map((job) => ({
          jobId: job.id,
          status: job.status,
          estimatedHours: job.estimatedHours,
          dueDate: job.dueDate,
          startedAt: job.startedAt,
        })),
        config,
        now,
      );

      const from = schedule.busyUntil ? new Date(schedule.busyUntil) : now;
      const { end } = scheduleWorkHours(from, hours, config);
      const endMs = end.getTime();
      const name = profile.name;
      if (
        !best ||
        endMs < best.endMs ||
        (endMs === best.endMs && name.localeCompare(best.name) < 0)
      ) {
        best = {
          date: arDateKey(end),
          printerId: profile.id,
          endMs,
          name,
        };
      }
    }

    return { date: best!.date, printerId: best!.printerId };
  }

  getCapacity(weekOffsetInput?: number, now = new Date()) {
    const weekOffset = clampInt(weekOffsetInput, -52, 52, 0);
    const printers = this.queuePrinters();
    const eligible = this.eligibleJobs();
    const allMonSat = weekdaysMonSat(now, weekOffset);

    const dayIsWorkdaySomewhere = new Set<string>();
    for (const profile of printers) {
      const days = new Set(profile.workWeekdays ?? [1, 2, 3, 4, 5, 6]);
      for (const day of allMonSat) {
        const weekday = weekdayOfDateKey(day);
        if (days.has(weekday)) dayIsWorkdaySomewhere.add(day);
      }
    }
    const days = allMonSat.filter((day) => dayIsWorkdaySomewhere.has(day));

    const printerRows = printers.map((profile) => {
      const jobs = this.sortQueueJobs(
        eligible.filter((job) => this.resolvedPrinterId(job) === profile.id),
      );
      const config = this.workConfig(profile);
      const schedule = buildPrinterSchedule(
        jobs.map((job) => ({
          jobId: job.id,
          status: job.status,
          estimatedHours: job.estimatedHours,
          dueDate: job.dueDate,
          startedAt: job.startedAt,
        })),
        config,
        now,
      );

      const workdaySet = new Set(config.workWeekdays);
      const hoursByDay: number[] = [];
      const full: boolean[] = [];
      let freeHours = 0;

      for (const day of days) {
        const weekday = weekdayOfDateKey(day);
        if (!workdaySet.has(weekday)) {
          hoursByDay.push(0);
          full.push(false);
          continue;
        }
        const used = hoursScheduledOnDay(schedule.jobs, day, config, now);
        hoursByDay.push(used);
        const capacity = config.workHoursPerDay;
        full.push(used >= capacity - 1e-9);
        freeHours += Math.max(0, capacity - used);
      }

      return {
        printerId: profile.id,
        name: profile.name,
        hoursByDay,
        full,
        freeHours,
      };
    });

    return { days, printers: printerRows };
  }

  assign(id: string, dto: AssignPrinterDto, actor?: PrintJobActor): PrintJob {
    const job = this.store.getPrintJobById(id);
    if (!job) {
      throw new NotFoundException(`Trabajo ${id} no encontrado`);
    }
    if (!this.isEligibleForPrinterQueue(job)) {
      throw new BadRequestException(
        'La tarea no es elegible para la cola de impresoras',
      );
    }

    this.orderTasks.assertActorCanMove(job, actor);

    let printerId: string | null;
    if (dto.printerId === 'auto') {
      printerId = this.pickAutoPrinter(
        new Date(),
        this.preferredPrinterForJob(job),
      );
      if (!printerId) {
        throw new BadRequestException(
          'No hay impresoras habilitadas en la cola',
        );
      }
    } else if (dto.printerId === null) {
      printerId = null;
    } else if (typeof dto.printerId === 'string') {
      const profile = this.requireQueuePrinter(dto.printerId);
      printerId = profile.id;
    } else {
      throw new BadRequestException('printerId inválido');
    }

    const previousPrinterId = this.resolvedPrinterId(job);

    if (printerId === null) {
      job.printerId = null;
      job.queuePosition = null;
      if (previousPrinterId) {
        this.renumberQueue(previousPrinterId);
      }
    } else {
      job.printerId = printerId;
      const queue = this.sortQueueJobs(
        this.eligibleJobs().filter(
          (item) =>
            item.id !== job.id && this.resolvedPrinterId(item) === printerId,
        ),
      );

      let position =
        dto.position !== undefined && Number.isFinite(Number(dto.position))
          ? Math.max(0, Math.floor(Number(dto.position)))
          : queue.length;
      position = Math.min(position, queue.length);
      queue.splice(position, 0, job);
      queue.forEach((item, index) => {
        item.printerId = printerId;
        item.queuePosition = index;
      });

      if (previousPrinterId && previousPrinterId !== printerId) {
        this.renumberQueue(previousPrinterId);
      }
    }

    this.storeChange?.recordChange({
      collections: ['printJobs'],
      realtime: {
        scopes: ['print-jobs', 'dashboard'],
        action: 'update',
        entity: 'print-job',
        id: job.id,
      },
    });

    return job;
  }

  /** Tareas FDM de impresión 3D elegibles para la cola. */
  isEligibleForPrinterQueue(job: PrintJob): boolean {
    if (job.archived) return false;
    if (!job.active) return false;
    if (!this.orderTasks.isVisibleInQueue(job.orderId)) return false;
    if (job.type !== ServiceType.IMPRESION_3D) return false;

    const taskType = job.taskType ?? TaskType.SERVICE;
    if (taskType !== TaskType.PRODUCTION && taskType !== TaskType.INTERNAL) {
      return false;
    }
    // Interna sin producto: el type impresion_3d marca el área del tablero
    // (ej. «Sacar correo…»), no un trabajo FDM para una impresora.
    if (taskType === TaskType.INTERNAL && !job.productId) {
      return false;
    }
    if (!QUEUE_STATUSES.has(job.status)) return false;
    if (this.isDesignPrintJob(job)) return false;
    if (!this.isFdmJob(job)) return false;
    return true;
  }

  private eligibleJobs(): PrintJob[] {
    return this.store.printJobs.filter((job) =>
      this.isEligibleForPrinterQueue(job),
    );
  }

  private queuePrinters(): MachineProfile[] {
    return fdmQueuePrinters(this.store.generalSettings).sort((a, b) =>
      a.name.localeCompare(b.name, 'es'),
    );
  }

  private preferredPrinterForJob(job: PrintJob): string | null {
    if (!job.productId) return null;
    const product = this.store.getProductById(job.productId);
    if (!product || product.type !== ProductType.FDM) return null;
    return resolvePreferredPrinterId(
      product.preferredPrinterId,
      this.store.generalSettings,
    );
  }

  private requireQueuePrinter(id: string): MachineProfile {
    const profile = ensureMachineProfiles(this.store.generalSettings).find(
      (item) => item.id === id,
    );
    if (
      !profile ||
      profile.role !== MachineProfileRole.PRINT ||
      !profile.queueEnabled ||
      (profile.productType !== undefined &&
        profile.productType !== ProductType.FDM)
    ) {
      throw new BadRequestException(
        'La impresora no existe, no está habilitada en la cola o no es FDM',
      );
    }
    return profile;
  }

  private resolvedPrinterId(job: PrintJob): string | null {
    if (!job.printerId) return null;
    const profile = this.queuePrinters().find(
      (item) => item.id === job.printerId,
    );
    return profile ? profile.id : null;
  }

  private sortQueueJobs(jobs: PrintJob[]): PrintJob[] {
    return [...jobs].sort((a, b) => {
      const aProc = a.status === PrintJobStatus.EN_PROCESO ? 0 : 1;
      const bProc = b.status === PrintJobStatus.EN_PROCESO ? 0 : 1;
      if (aProc !== bProc) return aProc - bProc;
      if (aProc === 0) {
        return (a.startedAt ?? '').localeCompare(b.startedAt ?? '');
      }
      const aPos = a.queuePosition ?? Number.MAX_SAFE_INTEGER;
      const bPos = b.queuePosition ?? Number.MAX_SAFE_INTEGER;
      if (aPos !== bPos) return aPos - bPos;
      const due = a.dueDate.localeCompare(b.dueDate);
      if (due !== 0) return due;
      return b.priority - a.priority;
    });
  }

  private renumberQueue(printerId: string): void {
    const jobs = this.sortQueueJobs(
      this.eligibleJobs().filter(
        (job) => this.resolvedPrinterId(job) === printerId,
      ),
    );
    jobs.forEach((job, index) => {
      job.printerId = printerId;
      job.queuePosition = index;
    });
  }

  private pickAutoPrinter(
    now: Date,
    preferredPrinterId?: string | null,
  ): string | null {
    const printers = this.queuePrinters();
    if (!printers.length) return null;
    if (preferredPrinterId) {
      const preferred = printers.find(
        (profile) => profile.id === preferredPrinterId,
      );
      if (preferred) return preferred.id;
    }
    const eligible = this.eligibleJobs();
    let best: { id: string; name: string; busyMs: number } | null = null;

    for (const profile of printers) {
      const jobs = this.sortQueueJobs(
        eligible.filter((job) => this.resolvedPrinterId(job) === profile.id),
      );
      const schedule = buildPrinterSchedule(
        jobs.map((job) => ({
          jobId: job.id,
          status: job.status,
          estimatedHours: job.estimatedHours,
          dueDate: job.dueDate,
          startedAt: job.startedAt,
        })),
        this.workConfig(profile),
        now,
      );
      const busyMs = schedule.busyUntil
        ? new Date(schedule.busyUntil).getTime()
        : Number.NEGATIVE_INFINITY;
      if (
        !best ||
        busyMs < best.busyMs ||
        (busyMs === best.busyMs &&
          profile.name.localeCompare(best.name, 'es') < 0)
      ) {
        best = { id: profile.id, name: profile.name, busyMs };
      }
    }
    return best?.id ?? null;
  }

  private workConfig(profile: MachineProfile): PrinterWorkConfig {
    return printerWorkConfig(profile);
  }

  private serializeProfile(profile: MachineProfile) {
    const colors = this.store.generalSettings.colors ?? [];
    // AMS se deriva de bobinas abiertas (amsSlots del perfil queda sin uso).
    const amsSlots = printerSlotsApi(
      profile.id,
      this.store.spools ?? [],
      this.store.supplies ?? [],
      colors,
    );
    return {
      id: profile.id,
      name: profile.name,
      amsType: profile.amsType ?? null,
      amsSlots,
      workHoursPerDay: profile.workHoursPerDay ?? 16,
      workWeekdays: profile.workWeekdays ?? [1, 2, 3, 4, 5, 6],
      workStartHour: profile.workStartHour ?? '08:00',
    };
  }

  private resolveJobColors(job: PrintJob): ColorConfig[] {
    const colors = this.store.generalSettings.colors ?? [];
    const ids: string[] = [];
    const order = job.orderId
      ? this.store.getOrderById(job.orderId)
      : undefined;
    const item = order?.items[job.orderItemIndex];
    if (item?.filaments?.length) {
      for (const line of item.filaments) {
        if (line.colorId) ids.push(line.colorId);
      }
    }
    if (job.productId) {
      const product = this.store.products.find((p) => p.id === job.productId);
      if (product && 'colorId' in product && product.colorId) {
        ids.push(product.colorId);
      }
      if (
        product &&
        'filaments' in product &&
        Array.isArray(product.filaments)
      ) {
        for (const line of product.filaments) {
          if (line.colorId) ids.push(line.colorId);
        }
      }
    }
    const seen = new Set<string>();
    const resolved: ColorConfig[] = [];
    for (const id of ids) {
      if (seen.has(id)) continue;
      seen.add(id);
      const color = findColorById(colors, id);
      if (color) resolved.push(color);
    }
    return resolved;
  }

  private isFdmJob(job: PrintJob): boolean {
    if (!job.productId) return true;
    const product = this.store.products.find((p) => p.id === job.productId);
    if (!product) return true;
    return product.type === ProductType.FDM;
  }

  private isDesignPrintJob(job: PrintJob): boolean {
    if (!job.orderId || job.orderItemIndex < 0) return false;
    const order = this.store.getOrderById(job.orderId);
    const item = order?.items[job.orderItemIndex];
    return item ? isDesignPrintConfigured(item) : false;
  }

  private otherAreasSummary(): Array<{
    area: string;
    count: number;
    hours: number;
  }> {
    const map = new Map<string, { count: number; hours: number }>();
    for (const job of this.store.printJobs) {
      if (job.archived) continue;
      if (!job.active) continue;
      if (!this.orderTasks.isVisibleInQueue(job.orderId)) continue;
      if (
        job.status === PrintJobStatus.TERMINADO ||
        job.status === PrintJobStatus.CANCELADO
      ) {
        continue;
      }
      if (this.isEligibleForPrinterQueue(job)) continue;

      const area = this.otherAreaKey(job);
      const entry = map.get(area) ?? { count: 0, hours: 0 };
      entry.count += 1;
      entry.hours += Math.max(0, Number(job.estimatedHours) || 0);
      map.set(area, entry);
    }
    return [...map.entries()]
      .map(([area, value]) => ({ area, ...value }))
      .sort((a, b) => a.area.localeCompare(b.area, 'es'));
  }

  /** Clave estable para agrupar «Otras áreas» (el frontend rotula en español). */
  private otherAreaKey(job: PrintJob): string {
    if (job.taskType === TaskType.PREPARE_ORDER) {
      return TaskType.PREPARE_ORDER;
    }
    if (job.taskType === TaskType.INTERNAL) return '';
    if (this.isDesignPrintJob(job)) {
      return 'impresion_diseno';
    }
    if (job.type === ServiceType.IMPRESION_3D && this.isResinJob(job)) {
      return 'impresion_3d_resina';
    }
    return job.type || '';
  }

  private isResinJob(job: PrintJob): boolean {
    if (!job.productId) {
      if (!job.orderId || job.orderItemIndex < 0) return false;
      const order = this.store.getOrderById(job.orderId);
      const item = order?.items[job.orderItemIndex];
      if (!item) return false;
      return (
        item.printProcess === 'resina' ||
        !!item.resinType ||
        (!!item.productId &&
          this.store.products.find((p) => p.id === item.productId)?.type ===
            ProductType.RESINA)
      );
    }
    const product = this.store.products.find((p) => p.id === job.productId);
    return product?.type === ProductType.RESINA;
  }
}

function clampInt(
  value: number | undefined,
  min: number,
  max: number,
  fallback: number,
): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

function weekdayOfDateKey(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function workWindowForDateKey(
  dayKey: string,
  config: PrinterWorkConfig,
): { start: Date; end: Date } | null {
  const [y, m, d] = dayKey.split('-').map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  if (!(config.workWeekdays ?? []).includes(weekday)) return null;
  const [hh, mm] = (config.workStartHour || '08:00').split(':').map(Number);
  const start = fromArLocal(y, m, d, hh || 0, mm || 0, 0);
  const end = new Date(
    start.getTime() +
      Math.max(1, Number(config.workHoursPerDay) || 16) * 60 * 60 * 1000,
  );
  return { start, end };
}

function hoursScheduledOnDay(
  jobs: Array<{
    jobId: string;
    start: string | null;
    end: string | null;
    blocked: boolean;
  }>,
  dayKey: string,
  config: PrinterWorkConfig,
  _now: Date,
): number {
  void _now;
  const window = workWindowForDateKey(dayKey, config);
  if (!window) return 0;
  let total = 0;
  for (const job of jobs) {
    if (job.blocked || !job.start || !job.end) continue;
    const segStart = Math.max(
      new Date(job.start).getTime(),
      window.start.getTime(),
    );
    const segEnd = Math.min(new Date(job.end).getTime(), window.end.getTime());
    if (segEnd > segStart) {
      total += workHoursBetween(new Date(segStart), new Date(segEnd), config);
    }
  }
  return total;
}
