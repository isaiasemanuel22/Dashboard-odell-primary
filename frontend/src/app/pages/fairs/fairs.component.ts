import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';
import {
  DbButtonComponent,
  DbStateMessageComponent,
  MobileBarComponent,
} from '@general-components';
import {
  Fair,
  FairDetail,
  FairPlan,
  FairSummary,
  FairsOverview,
} from '../../core/models';
import { FairsService } from '../../core/services/fairs.service';
import { PrintJobsService } from '../../core/services/print-jobs.service';
import { IndependentTaskFlowService } from '../../core/services/independent-task-flow.service';
import { DataChangedService } from '../../core/services/data-changed.service';
import { FormDialogService } from '../../modals/public-api';
import { CurrencyArsPipe } from '../../shared/pipes/labels.pipe';
import { extractApiErrorMessage } from '../../shared/utils/api-error';
import {
  FAIR_METHOD_LABELS,
  fairCashStatus,
  fairMonthParam,
  fairPlanItemsToPrint,
  fairPlanTaskName,
  formatBestHour,
  formatFairDate,
  formatFairDateLong,
  formatSignedAmount,
  pickFairForFairMode,
  shiftFairMonth,
  todayIsoDate,
} from '../../shared/utils/fair.util';

type ApiError = { error?: { message?: string | string[] } };

@Component({
  selector: 'app-fairs',
  standalone: true,
  imports: [
    RouterLink,
    CurrencyArsPipe,
    DbButtonComponent,
    DbStateMessageComponent,
    MobileBarComponent,
  ],
  templateUrl: './fairs.component.html',
  styleUrl: './fairs.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FairsComponent implements OnInit {
  private readonly fairsService = inject(FairsService);
  private readonly printJobs = inject(PrintJobsService);
  private readonly taskFlow = inject(IndependentTaskFlowService);
  private readonly dataChanged = inject(DataChangedService);
  private readonly formDialogs = inject(FormDialogService);
  private readonly router = inject(Router);

  readonly formatDate = formatFairDate;
  readonly formatDateLong = formatFairDateLong;
  readonly formatSigned = formatSignedAmount;
  readonly cashStatus = fairCashStatus;
  readonly formatBestHour = formatBestHour;
  readonly methodLabels = FAIR_METHOD_LABELS;

  readonly month = signal(shiftFairMonth(new Date(), 0));
  readonly overview = signal<FairsOverview | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal(false);
  /** Hasta que no termina de cargar el contexto no se sabe si hay feria para hoy. */
  readonly contextLoading = signal(true);
  /** Id de la feria cuyo plan ya se mandó a la cola (evita duplicar tareas). */
  readonly queuedFairId = signal<string | null>(null);
  readonly message = signal('');

  readonly selectedId = signal<string | null>(null);
  readonly detail = signal<FairDetail | null>(null);
  readonly detailLoading = signal(false);

  /** Ferias del mes anterior, actual y siguiente: modo feria y «Qué llevar». */
  private readonly context = signal<FairSummary[]>([]);
  readonly plan = signal<FairPlan | null>(null);
  readonly planLoading = signal(false);
  readonly queueing = signal(false);
  readonly busy = signal(false);

  readonly monthLabel = computed(() => {
    const label = this.month()
      .toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
      .replace(' de ', ' ');
    return label.charAt(0).toUpperCase() + label.slice(1);
  });

  readonly monthName = computed(() =>
    this.month().toLocaleDateString('es-AR', { month: 'long' }),
  );

  readonly fairs = computed(() => this.overview()?.fairs ?? []);

  readonly fairMode = computed(() =>
    pickFairForFairMode(this.context(), todayIsoDate()),
  );

  /** Próxima feria planificada; si no hay, la última por fecha. */
  readonly planFair = computed<FairSummary | null>(() => {
    const all = this.context();
    const today = todayIsoDate();
    const upcoming = all
      .filter((f) => f.status === 'planned' && f.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date));
    if (upcoming.length) return upcoming[0];
    const past = [...all].sort((a, b) => b.date.localeCompare(a.date));
    return past[0] ?? null;
  });

  readonly planToPrint = computed(() =>
    fairPlanItemsToPrint(this.plan()?.items ?? []),
  );

  ngOnInit(): void {
    this.load();
    this.loadContext();
  }

  shiftMonth(delta: number): void {
    this.month.set(shiftFairMonth(this.month(), delta));
    this.selectedId.set(null);
    this.detail.set(null);
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.fairsService.list(fairMonthParam(this.month())).subscribe({
      next: (overview) => {
        this.overview.set(overview);
        this.loading.set(false);
        const selected = this.selectedId();
        if (selected && !overview.fairs.some((f) => f.id === selected)) {
          this.selectedId.set(null);
          this.detail.set(null);
        }
      },
      error: () => {
        this.overview.set(null);
        this.loadError.set(true);
        this.loading.set(false);
      },
    });
  }

  private loadContext(): void {
    const now = new Date();
    const months = [-1, 0, 1].map((delta) =>
      fairMonthParam(shiftFairMonth(now, delta)),
    );
    forkJoin(
      months.map((m) =>
        this.fairsService.list(m).pipe(catchError(() => of(null))),
      ),
    ).subscribe((results) => {
      const fairs = results.flatMap((r) => r?.fairs ?? []);
      this.context.set(fairs);
      this.contextLoading.set(false);
      this.loadPlan();
    });
  }

  private loadPlan(): void {
    const fair = this.planFair();
    if (!fair) {
      this.plan.set(null);
      return;
    }
    this.planLoading.set(true);
    this.fairsService.plan(fair.name).subscribe({
      next: (plan) => {
        this.plan.set(plan);
        this.planLoading.set(false);
      },
      error: () => {
        this.plan.set(null);
        this.planLoading.set(false);
      },
    });
  }

  selectFair(fair: FairSummary, scrollToDetail = false): void {
    if (scrollToDetail) {
      // En celular el detalle queda debajo de la lista: lo llevamos a la vista.
      setTimeout(() =>
        document
          .getElementById('fair-detail')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      );
    }
    if (this.selectedId() === fair.id) return;
    this.selectedId.set(fair.id);
    this.detail.set(null);
    this.loadDetail(fair.id);
  }

  private loadDetail(id: string): void {
    this.detailLoading.set(true);
    this.fairsService.get(id).subscribe({
      next: (detail) => {
        if (this.selectedId() !== id) return;
        this.detail.set(detail);
        this.detailLoading.set(false);
      },
      error: () => {
        this.detailLoading.set(false);
        this.message.set('No se pudo cargar el detalle de la feria.');
      },
    });
  }

  private refreshAll(): void {
    this.load();
    this.loadContext();
    const id = this.selectedId();
    if (id) this.loadDetail(id);
  }

  openNewFair(): void {
    this.formDialogs.openFairForm().subscribe((payload) => {
      if (!payload) return;
      this.fairsService.create(payload).subscribe({
        next: () => {
          this.message.set('Feria creada.');
          this.refreshAll();
        },
        error: (err: ApiError) =>
          this.message.set(
            extractApiErrorMessage(err, 'No se pudo crear la feria'),
          ),
      });
    });
  }

  /** Va al modo feria; si la feria es de hoy y está planificada, pide el fondo inicial. */
  openFairMode(): void {
    const mode = this.fairMode();
    if (!mode) return;
    const target = mode.fair;
    if (!mode.needsOpening) {
      void this.router.navigate(['/ferias', target.id, 'vender']);
      return;
    }
    this.formDialogs
      .openFairAmount({
        title: 'Abrir caja',
        confirmLabel: 'Abrir caja',
        amountLabel: 'Fondo inicial',
        hint: 'Efectivo con el que arrancás la caja.',
      })
      .pipe(
        switchMap((result) =>
          result ? this.fairsService.open(target.id, result.amount) : of(null),
        ),
      )
      .subscribe({
        next: (opened: Fair | null) => {
          if (!opened) return;
          void this.router.navigate(['/ferias', target.id, 'vender']);
        },
        error: (err: ApiError) =>
          this.message.set(
            extractApiErrorMessage(err, 'No se pudo abrir la caja'),
          ),
      });
  }

  addExpense(detail: FairDetail): void {
    this.formDialogs
      .openFairAmount({
        title: 'Cargar gasto',
        confirmLabel: 'Guardar gasto',
        nameLabel: 'Concepto',
        namePlaceholder: 'Ej.: Stand',
        amountLabel: 'Monto',
        amountRequired: true,
        showAccount: true,
      })
      .pipe(
        switchMap((result) =>
          result
            ? this.fairsService
                .addExpense(detail.id, {
                  name: result.name,
                  amount: result.amount,
                  account: result.account,
                })
                .pipe(map(() => true))
            : of(false),
        ),
      )
      .subscribe({
        next: (saved) => {
          if (!saved) return;
          this.message.set('Gasto cargado.');
          this.refreshAll();
        },
        error: (err: ApiError) =>
          this.message.set(
            extractApiErrorMessage(err, 'No se pudo cargar el gasto'),
          ),
      });
  }

  canDelete(detail: FairDetail): boolean {
    return detail.salesCount === 0 && detail.expensesList.length === 0;
  }

  deleteFair(detail: FairDetail): void {
    this.formDialogs
      .openConfirm({
        title: 'Eliminar feria',
        message: `¿Eliminar «${detail.name}»? Solo se puede si no tiene ventas ni gastos.`,
        confirmLabel: 'Eliminar',
        confirmVariant: 'delete',
      })
      .pipe(
        switchMap((ok) =>
          ok ? this.fairsService.remove(detail.id) : of(null),
        ),
      )
      .subscribe({
        next: (res) => {
          if (!res) return;
          this.selectedId.set(null);
          this.detail.set(null);
          this.message.set('Feria eliminada.');
          this.refreshAll();
        },
        error: (err: ApiError) =>
          this.message.set(
            extractApiErrorMessage(err, 'No se pudo eliminar la feria'),
          ),
      });
  }

  /** Una tarea independiente por cada ítem con unidades para imprimir. */
  queuePlan(): void {
    const items = this.planToPrint();
    const fair = this.planFair();
    if (!items.length || !fair || this.queuedFairId() === fair.id) return;
    this.formDialogs
      .openConfirm({
        title: 'Agregar a la cola',
        message: `Se van a crear ${items.length} ${items.length === 1 ? 'tarea' : 'tareas'} en la cola (${items
          .map(fairPlanTaskName)
          .join(', ')}). ¿Seguimos?`,
        confirmLabel: 'Agregar a la cola',
      })
      .pipe(
        switchMap((ok) =>
          ok ? this.taskFlow.currentResponsibleId() : of(null),
        ),
      )
      .subscribe((uid) => {
        if (uid === null) return;
        this.queueing.set(true);
        forkJoin(
          items.map((item) =>
            this.printJobs
              .createIndependent({
                productName: fairPlanTaskName(item),
                type: '',
                dueDate: fair.date >= todayIsoDate() ? fair.date : undefined,
                responsibleUserId: uid || undefined,
              })
              .pipe(catchError(() => of(null))),
          ),
        ).subscribe((jobs) => {
          const created = jobs.filter(Boolean).length;
          this.queueing.set(false);
          if (created > 0) {
            this.queuedFairId.set(fair.id);
            this.dataChanged.emit('print-jobs');
          }
          this.message.set(
            created === items.length
              ? `Se ${created === 1 ? 'creó 1 tarea' : `crearon ${created} tareas`} en la cola.`
              : `Se crearon ${created} de ${items.length} tareas en la cola; las demás fallaron.`,
          );
        });
      });
  }

  recurringLabel(fair: Pick<Fair, 'calendarEntryId' | 'recurring'>): string {
    if (fair.calendarEntryId) {
      return fair.recurring
        ? 'Evento del calendario · se repite'
        : 'Evento del calendario';
    }
    return fair.recurring ? 'Se repite' : 'Único';
  }

  kpiBestSub(): string {
    const best = this.overview()?.kpis.bestFair;
    if (!best) return 'Todavía sin ferias cerradas';
    const [, m, d] = best.date.slice(0, 10).split('-');
    return `${formatSignedAmountPlain(best.result)} de resultado el ${d}/${m}`;
  }

  trackFair(_: number, fair: FairSummary): string {
    return fair.id;
  }
}

function formatSignedAmountPlain(value: number): string {
  const abs = new Intl.NumberFormat('es-AR', {
    maximumFractionDigits: 0,
  }).format(Math.abs(value));
  return value < 0 ? `−$ ${abs}` : `$ ${abs}`;
}
