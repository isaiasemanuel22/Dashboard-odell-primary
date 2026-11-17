import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { of, switchMap } from 'rxjs';
import { DbInputComponent } from '@dashboard-form';
import { LayoutUiService } from '../../../layout/layout-ui.service';
import { FairDetail } from '../../../core/models';
import { FairsService } from '../../../core/services/fairs.service';
import { FormDialogService } from '../../../modals/public-api';
import { CurrencyArsPipe } from '../../../shared/pipes/labels.pipe';
import { extractApiErrorMessage } from '../../../shared/utils/api-error';
import {
  formatArsAmountEditable,
  formatCurrencyArs,
  formatCurrencyArsExact,
  parseArsAmount,
} from '../../../shared/utils/currency-ars.util';
import {
  fairCashDifference,
  fairExpectedCash,
  fairReasonRequired,
  formatFairDate,
  formatFairTime,
  formatSignedAmount,
} from '../../../shared/utils/fair.util';

type ApiError = { error?: { message?: string | string[] } };

@Component({
  selector: 'app-fair-close',
  standalone: true,
  imports: [RouterLink, FormsModule, CurrencyArsPipe, DbInputComponent],
  templateUrl: './fair-close.component.html',
  styleUrl: './fair-close.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FairCloseComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly fairsService = inject(FairsService);
  private readonly formDialogs = inject(FormDialogService);
  private readonly layoutUi = inject(LayoutUiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly fairId = this.route.snapshot.paramMap.get('id') ?? '';
  readonly formatDate = formatFairDate;
  readonly formatTime = formatFairTime;
  readonly formatSigned = formatSignedAmount;

  readonly fair = signal<FairDetail | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal('');
  readonly error = signal('');
  readonly saving = signal(false);

  readonly counted = signal<number | null>(null);
  readonly reason = signal('');

  readonly isClosed = computed(() => this.fair()?.status === 'closed');
  readonly isOpen = computed(() => this.fair()?.status === 'open');

  readonly cashSales = computed(() => this.fair()?.byMethod.efectivo ?? 0);

  readonly expected = computed(() => {
    const f = this.fair();
    if (!f) return 0;
    return (
      f.expectedCash ?? fairExpectedCash(f.openingFloat, f.byMethod.efectivo)
    );
  });

  readonly difference = computed<number | null>(() => {
    const counted = this.counted();
    if (counted === null || !Number.isFinite(Number(counted))) return null;
    return fairCashDifference(Number(counted), this.expected());
  });

  readonly needsReason = computed(() => {
    const diff = this.difference();
    return diff !== null && fairReasonRequired(diff);
  });

  readonly canClose = computed(() => {
    if (!this.isOpen() || this.saving()) return false;
    const diff = this.difference();
    if (diff === null) return false;
    return !this.needsReason() || !!this.reason().trim();
  });

  ngOnInit(): void {
    this.layoutUi.registerPageBar();
    this.destroyRef.onDestroy(() => this.layoutUi.unregisterPageBar());
    this.load(true);
  }

  private load(initial = false): void {
    this.fairsService.get(this.fairId).subscribe({
      next: (fair) => {
        this.fair.set(fair);
        this.loading.set(false);
      },
      error: (err: ApiError) => {
        if (initial) {
          this.loadError.set(
            extractApiErrorMessage(err, 'No se pudo cargar la feria.'),
          );
          this.loading.set(false);
        }
      },
    });
  }

  /** Mientras se escribe, el texto tal cual; al salir, el monto con formato $. */
  readonly countedFocused = signal(false);
  private readonly countedText = signal('');

  readonly countedDisplay = computed(() => {
    if (this.countedFocused()) return this.countedText();
    const value = this.counted();
    return value === null ? '' : formatCurrencyArsExact(value);
  });

  onCountedFocus(event: Event): void {
    const value = this.counted();
    this.countedText.set(value === null ? '' : formatArsAmountEditable(value));
    this.countedFocused.set(true);
    const el = event.target as HTMLInputElement;
    setTimeout(() => el.select());
  }

  onCountedInput(raw: string): void {
    const cleaned = raw.replace(/[^\d.,]/g, '');
    this.countedText.set(cleaned);
    this.counted.set(parseArsAmount(cleaned));
  }

  addExpense(): void {
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
            ? this.fairsService.addExpense(this.fairId, {
                name: result.name,
                amount: result.amount,
                account: result.account,
              })
            : of(null),
        ),
      )
      .subscribe({
        next: () => this.load(),
        error: (err: ApiError) =>
          this.error.set(
            extractApiErrorMessage(err, 'No se pudo cargar el gasto'),
          ),
      });
  }

  close(): void {
    const counted = this.counted();
    const diff = this.difference();
    if (!this.canClose() || counted === null || diff === null) return;
    this.formDialogs
      .openConfirm({
        title: 'Cerrar caja',
        message: `Vas a cerrar la caja con ${formatCurrencyArs(Number(counted))} contados (${
          fairReasonRequired(diff)
            ? `diferencia ${formatSignedAmount(diff)}`
            : 'sin diferencia'
        }). Después no se puede vender ni reabrir.`,
        confirmLabel: 'Cerrar caja',
      })
      .pipe(
        switchMap((ok) => {
          if (!ok) return of(null);
          this.saving.set(true);
          this.error.set('');
          return this.fairsService.close(this.fairId, {
            countedCash: Number(counted),
            ...(this.needsReason()
              ? { differenceReason: this.reason().trim() }
              : {}),
          });
        }),
      )
      .subscribe({
        next: (closed) => {
          this.saving.set(false);
          if (closed) this.load();
        },
        error: (err: ApiError) => {
          this.saving.set(false);
          this.error.set(
            extractApiErrorMessage(err, 'No se pudo cerrar la caja'),
          );
        },
      });
  }
}
