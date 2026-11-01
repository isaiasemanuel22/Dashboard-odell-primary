import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import {
  Supply,
  TreasuryDebtorBalance,
  TreasuryExpense,
  TreasuryExpenseCategory,
  TreasuryMovement,
  TreasuryOverview,
} from '../../core/models';
import { DashboardService } from '../../core/services/dashboard.service';
import { RealtimeService } from '../../core/services/realtime.service';
import { SuppliesService } from '../../core/services/settings.service';
import { TreasuryService } from '../../core/services/treasury.service';
import { OdlActionEvent } from '../../components/db-data-table';
import { FormDialogService } from '../../shared/form-dialogs/form-dialog.service';
import { extractApiErrorMessage } from '../../shared/utils/api-error';
import { DbButtonComponent, DbStateMessageComponent } from '@general-components';
import { WalletDebtorsComponent } from './components/wallet-debtors/wallet-debtors.component';
import { WalletMetricsComponent } from './components/wallet-metrics/wallet-metrics.component';
import { WalletMovementsComponent } from './components/wallet-movements/wallet-movements.component';
import {
  WalletFormMode,
  WalletRecordFormComponent,
} from './components/wallet-record-form/wallet-record-form.component';
import { WalletRepaymentFormComponent } from './components/wallet-repayment-form/wallet-repayment-form.component';
import { WalletTransferFormComponent } from './components/wallet-transfer-form/wallet-transfer-form.component';
import { WalletVoidFormComponent } from './components/wallet-void-form/wallet-void-form.component';

@Component({
  selector: 'app-wallet',
  standalone: true,
  imports: [
    DbButtonComponent,
    DbStateMessageComponent,
    WalletMetricsComponent,
    WalletMovementsComponent,
    WalletDebtorsComponent,
    WalletRecordFormComponent,
    WalletRepaymentFormComponent,
    WalletTransferFormComponent,
    WalletVoidFormComponent,
  ],
  templateUrl: './wallet.component.html',
  styleUrl: './wallet.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WalletComponent implements OnInit {
  private readonly treasuryService = inject(TreasuryService);
  private readonly dashboardService = inject(DashboardService);
  private readonly suppliesService = inject(SuppliesService);
  private readonly formDialogs = inject(FormDialogService);
  private readonly realtime = inject(RealtimeService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  overview: TreasuryOverview | null = null;
  clientDebt = 0;
  supplies: Supply[] = [];
  loading = true;
  loadError = false;
  showForm = false;
  showTransferForm = false;
  formMode: WalletFormMode = 'general';
  editingExpense: TreasuryExpense | null = null;
  voidingExpense: TreasuryExpense | null = null;
  purchasePreset = false;
  repaymentDebtor: TreasuryDebtorBalance | null = null;

  readonly periodLabel = WalletComponent.currentPeriodLabel();

  ngOnInit(): void {
    this.loadOverview();
    this.realtime.bindReload(
      this.destroyRef,
      'dashboard',
      () => this.refreshOverview(),
      {
        skip: () =>
          this.showForm ||
          this.showTransferForm ||
          this.repaymentDebtor != null ||
          this.voidingExpense != null,
      },
    );

    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        if (params.get('compra') !== '1') return;
        this.purchasePreset = true;
        this.openForm();
        void this.router.navigate([], {
          queryParams: { compra: null },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
      });

    this.suppliesService
      .watchSupplies()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((supplies) => {
        this.supplies = supplies;
        this.cdr.markForCheck();
      });
  }

  loadOverview(): void {
    this.loading = true;
    this.loadError = false;
    this.cdr.markForCheck();

    forkJoin({
      overview: this.treasuryService.getOverview(),
      stats: this.dashboardService.getStats(),
    }).subscribe({
      next: ({ overview, stats }) => {
        this.overview = overview;
        this.clientDebt = stats.clientDebt;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.loadError = true;
        this.cdr.markForCheck();
      },
    });
  }

  openForm(): void {
    this.editingExpense = null;
    this.formMode = 'general';
    this.showForm = true;
    this.cdr.markForCheck();
  }

  openPaymentForm(): void {
    this.editingExpense = null;
    this.formMode = 'payment';
    this.showForm = true;
    this.cdr.markForCheck();
  }

  openLoanForm(): void {
    this.editingExpense = null;
    this.formMode = 'loan';
    this.showForm = true;
    this.cdr.markForCheck();
  }

  openTransferForm(): void {
    this.showTransferForm = true;
    this.cdr.markForCheck();
  }

  closeTransferForm(): void {
    this.showTransferForm = false;
    this.cdr.markForCheck();
  }

  onTransferSaved(): void {
    this.showTransferForm = false;
    this.refreshOverview();
  }

  onMovementAction(event: OdlActionEvent<TreasuryMovement>): void {
    if (event.actionId === 'ver-pedido' && event.row.orderId) {
      void this.router.navigate(['/pedidos', event.row.orderId]);
      return;
    }
    if (event.actionId === 'ver-venta') {
      void this.router.navigate(['/ventas', event.row.id, 'editar']);
      return;
    }

    const expense = this.expenseForMovement(event.row);
    if (!expense) return;
    if (event.actionId === 'editar') this.openEdit(expense);
    if (event.actionId === 'anular') this.openVoid(expense);
  }

  closeForm(): void {
    this.showForm = false;
    this.purchasePreset = false;
    this.editingExpense = null;
    this.cdr.markForCheck();
  }

  onFormSaved(): void {
    this.showForm = false;
    this.refreshOverview();
  }

  openRepaymentForm(debtor: TreasuryDebtorBalance): void {
    this.repaymentDebtor = debtor;
    this.cdr.markForCheck();
  }

  closeRepaymentForm(): void {
    this.repaymentDebtor = null;
    this.cdr.markForCheck();
  }

  onRepaymentSaved(): void {
    this.repaymentDebtor = null;
    this.refreshOverview();
  }

  closeVoidForm(): void {
    this.voidingExpense = null;
    this.cdr.markForCheck();
  }

  onVoidSaved(): void {
    const wasPurchase =
      this.voidingExpense?.category === TreasuryExpenseCategory.SUPPLY_PURCHASE;
    this.voidingExpense = null;
    if (wasPurchase) {
      this.suppliesService.refreshSupplies().subscribe();
    }
    this.refreshOverview();
  }

  private openEdit(expense: TreasuryExpense): void {
    this.purchasePreset = false;
    this.repaymentDebtor = null;
    this.voidingExpense = null;
    this.editingExpense = expense;
    this.formMode = this.modeFor(expense);
    this.showForm = true;
    this.cdr.markForCheck();
  }

  private openVoid(expense: TreasuryExpense): void {
    this.showForm = false;
    this.showTransferForm = false;
    this.repaymentDebtor = null;
    this.editingExpense = null;
    this.voidingExpense = expense;
    this.cdr.markForCheck();
  }

  private expenseForMovement(
    movement: TreasuryMovement,
  ): TreasuryExpense | undefined {
    const id = movement.recordId ?? movement.id;
    return this.overview?.expenses.find((expense) => expense.id === id);
  }

  private modeFor(expense: TreasuryExpense): WalletFormMode {
    if (expense.category === TreasuryExpenseCategory.PAYMENT) return 'payment';
    if (expense.category === TreasuryExpenseCategory.LOAN) return 'loan';
    return 'general';
  }

  private static currentPeriodLabel(): string {
    const raw = new Date().toLocaleDateString('es-AR', {
      month: 'long',
      year: 'numeric',
    });
    return raw.replace(' de ', ' ');
  }

  private refreshOverview(): void {
    forkJoin({
      overview: this.treasuryService.getOverview(),
      stats: this.dashboardService.getStats(),
    }).subscribe({
      next: ({ overview, stats }) => {
        this.overview = overview;
        this.clientDebt = stats.clientDebt;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.formDialogs
          .openConfirm({
            title: 'No se pudo actualizar',
            message: extractApiErrorMessage(
              err,
              'No se pudo refrescar la billetera',
            ),
            confirmLabel: 'Entendido',
            alertOnly: true,
          })
          .subscribe();
      },
    });
  }
}
