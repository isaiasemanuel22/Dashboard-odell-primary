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
import {
  Supply,
  TreasuryDebtorBalance,
  TreasuryExpense,
  TreasuryExpenseCategory,
  TreasuryOverview,
} from '../../core/models';
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
  ],
  templateUrl: './wallet.component.html',
  styleUrl: './wallet.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WalletComponent implements OnInit {
  private readonly treasuryService = inject(TreasuryService);
  private readonly suppliesService = inject(SuppliesService);
  private readonly formDialogs = inject(FormDialogService);
  private readonly realtime = inject(RealtimeService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  overview: TreasuryOverview | null = null;
  supplies: Supply[] = [];
  loading = true;
  loadError = false;
  showForm = false;
  formMode: WalletFormMode = 'general';
  editingExpense: TreasuryExpense | null = null;
  purchasePreset = false;
  repaymentDebtor: TreasuryDebtorBalance | null = null;

  ngOnInit(): void {
    this.loadOverview();
    this.realtime.bindReload(
      this.destroyRef,
      'dashboard',
      () => this.refreshOverview(),
      {
        skip: () => this.showForm || this.repaymentDebtor != null,
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

    this.treasuryService.getOverview().subscribe({
      next: (overview) => {
        this.overview = overview;
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

  onMovementAction(event: OdlActionEvent<TreasuryExpense>): void {
    if (event.actionId === 'editar') this.openEdit(event.row);
    if (event.actionId === 'eliminar') this.confirmDelete(event.row);
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

  private openEdit(expense: TreasuryExpense): void {
    this.purchasePreset = false;
    this.repaymentDebtor = null;
    this.editingExpense = expense;
    this.formMode = this.modeFor(expense);
    this.showForm = true;
    this.cdr.markForCheck();
  }

  private confirmDelete(expense: TreasuryExpense): void {
    this.formDialogs
      .openConfirm({
        title: 'Eliminar registro',
        message: `¿Eliminar "${expense.name}"?`,
        confirmLabel: 'Eliminar',
        confirmVariant: 'delete',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.treasuryService.deleteExpense(expense.id).subscribe({
          next: () => {
            this.suppliesService.refreshSupplies().subscribe();
            this.refreshOverview();
          },
          error: (err) => {
            this.formDialogs
              .openConfirm({
                title: 'No se pudo eliminar',
                message: extractApiErrorMessage(
                  err,
                  'No se pudo eliminar el registro',
                ),
                confirmLabel: 'Entendido',
                alertOnly: true,
              })
              .subscribe();
          },
        });
      });
  }

  private modeFor(expense: TreasuryExpense): WalletFormMode {
    if (expense.category === TreasuryExpenseCategory.PAYMENT) return 'payment';
    if (expense.category === TreasuryExpenseCategory.LOAN) return 'loan';
    return 'general';
  }

  private refreshOverview(): void {
    this.treasuryService.getOverview().subscribe({
      next: (overview) => {
        this.overview = overview;
        this.cdr.markForCheck();
      },
    });
  }
}
