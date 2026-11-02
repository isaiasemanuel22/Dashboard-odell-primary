import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
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
import { BreakpointService } from '../../core/services/breakpoint.service';
import { DashboardService } from '../../core/services/dashboard.service';
import { RealtimeService } from '../../core/services/realtime.service';
import { SuppliesService } from '../../core/services/settings.service';
import { TreasuryService } from '../../core/services/treasury.service';
import { OdlActionEvent } from '../../components/db-data-table';
import { LayoutUiService } from '../../layout/layout-ui.service';
import { FormDialogService } from '../../shared/form-dialogs/form-dialog.service';
import { extractApiErrorMessage } from '../../shared/utils/api-error';
import {
  DbButtonComponent,
  DbStateMessageComponent,
  MobileBarComponent,
} from '@general-components';
import { WalletDebtorsComponent } from './components/wallet-debtors/wallet-debtors.component';
import {
  WalletAccountFilter,
  WalletMetricsComponent,
} from './components/wallet-metrics/wallet-metrics.component';
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
    FormsModule,
    DbButtonComponent,
    DbStateMessageComponent,
    MobileBarComponent,
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
export class WalletComponent implements OnInit, OnDestroy {
  private readonly treasuryService = inject(TreasuryService);
  private readonly dashboardService = inject(DashboardService);
  private readonly suppliesService = inject(SuppliesService);
  private readonly formDialogs = inject(FormDialogService);
  private readonly realtime = inject(RealtimeService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly breakpoint = inject(BreakpointService);
  private readonly layoutUi = inject(LayoutUiService);

  readonly isMobile = this.breakpoint.isMobile;

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

  showMobileSearch = false;
  mobileSearch = '';
  mobileAccountFilter: WalletAccountFilter = 'all';
  payLoanSheetOpen = false;
  /** Overlay activo por un form-modal de billetera en mobile. */
  private formOverlayPushed = false;

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

  ngOnDestroy(): void {
    if (this.payLoanSheetOpen) {
      this.layoutUi.popOverlay();
      this.payLoanSheetOpen = false;
    }
    this.releaseFormOverlay();
  }

  toggleMobileSearch(): void {
    this.showMobileSearch = !this.showMobileSearch;
    if (!this.showMobileSearch) {
      this.mobileSearch = '';
    }
    this.cdr.markForCheck();
  }

  onMobileSearchChange(): void {
    this.cdr.markForCheck();
  }

  clearMobileSearch(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.mobileSearch = '';
    this.cdr.markForCheck();
  }

  onMobileAccountSelect(account: WalletAccountFilter): void {
    this.mobileAccountFilter = account;
    this.cdr.markForCheck();
  }

  openPayLoanSheet(): void {
    if (this.payLoanSheetOpen) return;
    this.payLoanSheetOpen = true;
    this.layoutUi.pushOverlay();
    this.cdr.markForCheck();
  }

  closePayLoanSheet(): void {
    if (!this.payLoanSheetOpen) return;
    this.payLoanSheetOpen = false;
    this.layoutUi.popOverlay();
    this.cdr.markForCheck();
  }

  choosePayment(): void {
    this.closePayLoanSheet();
    this.openPaymentForm();
  }

  chooseLoan(): void {
    this.closePayLoanSheet();
    this.openLoanForm();
  }

  openForm(): void {
    this.editingExpense = null;
    this.formMode = 'general';
    this.showForm = true;
    this.claimFormOverlay();
    this.cdr.markForCheck();
  }

  openPaymentForm(): void {
    this.editingExpense = null;
    this.formMode = 'payment';
    this.showForm = true;
    this.claimFormOverlay();
    this.cdr.markForCheck();
  }

  openLoanForm(): void {
    this.editingExpense = null;
    this.formMode = 'loan';
    this.showForm = true;
    this.claimFormOverlay();
    this.cdr.markForCheck();
  }

  openTransferForm(): void {
    this.showTransferForm = true;
    this.claimFormOverlay();
    this.cdr.markForCheck();
  }

  closeTransferForm(): void {
    this.showTransferForm = false;
    this.releaseFormOverlay();
    this.cdr.markForCheck();
  }

  onTransferSaved(): void {
    this.showTransferForm = false;
    this.releaseFormOverlay();
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
    this.releaseFormOverlay();
    this.cdr.markForCheck();
  }

  onFormSaved(): void {
    this.showForm = false;
    this.releaseFormOverlay();
    this.refreshOverview();
  }

  openRepaymentForm(debtor: TreasuryDebtorBalance): void {
    this.repaymentDebtor = debtor;
    this.claimFormOverlay();
    this.cdr.markForCheck();
  }

  closeRepaymentForm(): void {
    this.repaymentDebtor = null;
    this.releaseFormOverlay();
    this.cdr.markForCheck();
  }

  onRepaymentSaved(): void {
    this.repaymentDebtor = null;
    this.releaseFormOverlay();
    this.refreshOverview();
  }

  closeVoidForm(): void {
    this.voidingExpense = null;
    this.releaseFormOverlay();
    this.cdr.markForCheck();
  }

  onVoidSaved(): void {
    const wasPurchase =
      this.voidingExpense?.category === TreasuryExpenseCategory.SUPPLY_PURCHASE;
    this.voidingExpense = null;
    this.releaseFormOverlay();
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
    this.claimFormOverlay();
    this.cdr.markForCheck();
  }

  private openVoid(expense: TreasuryExpense): void {
    this.showForm = false;
    this.showTransferForm = false;
    this.repaymentDebtor = null;
    this.editingExpense = null;
    this.voidingExpense = expense;
    this.claimFormOverlay();
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

  private claimFormOverlay(): void {
    if (!this.isMobile() || this.formOverlayPushed) return;
    this.formOverlayPushed = true;
    this.layoutUi.pushOverlay();
  }

  private releaseFormOverlay(): void {
    if (!this.formOverlayPushed) return;
    this.formOverlayPushed = false;
    this.layoutUi.popOverlay();
  }
}
