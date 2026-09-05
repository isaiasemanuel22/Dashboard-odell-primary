import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { FormsModule } from '@angular/forms';
import {
  Supply,
  TreasuryDebtorBalance,
  TreasuryExpense,
  TreasuryExpenseCategory,
  TreasuryMovementDirection,
  TreasuryOverview,
} from '../../core/models';
import { RealtimeService } from '../../core/services/realtime.service';
import { SuppliesService } from '../../core/services/settings.service';
import { TreasuryService } from '../../core/services/treasury.service';
import {
  DbButtonComponent,
  DbStateMessageComponent,
  DbAutocompleteComponent,
} from '@general-components';
import type { DbAutocompleteOption } from '@dashboard-form/db-autocomplete/db-autocomplete.types';
import { DbFormFieldComponent } from '../../components/dashboard-form/db-form-field/db-form-field.component';
import {
  DbFormGridComponent,
  DbFormGridFullComponent,
} from '../../components/dashboard-form/db-form-grid/db-form-grid.component';
import { FormModalComponent } from '../../components/form-modal/form-modal.component';
import { CurrencyArsPipe } from '../../shared/pipes/labels.pipe';
import { extractApiErrorMessage } from '../../shared/utils/api-error';
import { computeSupplyPurchaseDelta } from '../../shared/utils/supply-unit.util';
import { FormDialogService } from '../../shared/form-dialogs/form-dialog.service';

interface WalletSupplyLine {
  supplyId: string;
  supplyName: string;
  unit: string;
  quantity: number;
  amountSpent: number;
  unitPrice: number;
}

type WalletFormMode = 'general' | 'payment' | 'loan';

@Component({
  selector: 'app-wallet',
  standalone: true,
  imports: [
    FormsModule,
    CurrencyArsPipe,
    DbButtonComponent,
    DbStateMessageComponent,
    DbFormFieldComponent,
    DbFormGridComponent,
    DbFormGridFullComponent,
    DbAutocompleteComponent,
    FormModalComponent,
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

  overview: TreasuryOverview | null = null;
  supplies: Supply[] = [];
  loading = true;
  loadError = false;
  showForm = false;
  showRepaymentForm = false;
  saving = false;
  repaymentSaving = false;
  formError = '';
  repaymentError = '';
  formMode: WalletFormMode = 'general';

  isSupplyPurchase = false;
  movementDirection: TreasuryMovementDirection = TreasuryMovementDirection.EXPENSE;
  readonly movementDirections = TreasuryMovementDirection;
  name = '';
  recipientName = '';
  amount = 0;
  expenseDate = WalletComponent.todayInputValue();
  readonly maxExpenseDate = WalletComponent.todayInputValue();

  repaymentDebtorName = '';
  repaymentDebtorAmount = 0;
  repaymentAmount = 0;
  repaymentDate = WalletComponent.todayInputValue();

  selectedSupplyId = '';
  supplyLines: WalletSupplyLine[] = [];

  ngOnInit(): void {
    this.loadOverview();
    this.realtime.bindReload(
      this.destroyRef,
      'dashboard',
      () => this.refreshOverview(),
      {
        skip: () =>
          this.saving ||
          this.repaymentSaving ||
          this.showForm ||
          this.showRepaymentForm,
      },
    );

    this.suppliesService
      .watchSupplies()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((supplies) => {
        this.supplies = supplies;
        this.cdr.markForCheck();
      });
  }

  get computedSupplyTotal(): number {
    return Math.round(
      this.supplyLines.reduce(
        (sum, line) => sum + (Number(line.amountSpent) || 0),
        0,
      ),
    );
  }

  get availableSupplies(): Supply[] {
    const used = new Set(this.supplyLines.map((line) => line.supplyId));
    return this.supplies.filter((supply) => !used.has(supply.id));
  }

  get nameSuggestions(): string[] {
    return this.overview?.recordNameSuggestions ?? [];
  }

  get nameOptions(): DbAutocompleteOption[] {
    return this.nameSuggestions.map((name) => ({
      value: name,
      label: name,
    }));
  }

  get recipientOptions(): DbAutocompleteOption[] {
    return this.recipientNameSuggestions.map((name) => ({
      value: name,
      label: name,
    }));
  }

  get recipientNameSuggestions(): string[] {
    return this.overview?.recipientNameSuggestions ?? [];
  }

  get formTitle(): string {
    switch (this.formMode) {
      case 'payment':
        return 'Pagar';
      case 'loan':
        return 'Prestar';
      default:
        return 'Agregar registro';
    }
  }

  get isPersonMovementForm(): boolean {
    return this.formMode === 'payment' || this.formMode === 'loan';
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

  private refreshOverview(): void {
    this.treasuryService.getOverview().subscribe({
      next: (overview) => {
        this.overview = overview;
        this.cdr.markForCheck();
      },
    });
  }

  openForm(): void {
    this.openFormWithMode('general');
  }

  openPaymentForm(): void {
    this.openFormWithMode('payment');
  }

  openLoanForm(): void {
    this.openFormWithMode('loan');
  }

  private openFormWithMode(mode: WalletFormMode): void {
    this.resetForm(mode);
    this.showForm = true;
    this.cdr.markForCheck();
  }

  closeForm(): void {
    this.showForm = false;
    this.formError = '';
    this.cdr.markForCheck();
  }

  openRepaymentForm(debtor: TreasuryDebtorBalance): void {
    this.repaymentDebtorName = debtor.name;
    this.repaymentDebtorAmount = debtor.amount;
    this.repaymentAmount = debtor.amount;
    this.repaymentDate = WalletComponent.todayInputValue();
    this.repaymentError = '';
    this.showRepaymentForm = true;
    this.cdr.markForCheck();
  }

  closeRepaymentForm(): void {
    this.showRepaymentForm = false;
    this.repaymentSaving = false;
    this.repaymentError = '';
    this.cdr.markForCheck();
  }

  onRepaymentAmountChange(): void {
    this.repaymentAmount = Math.max(0, Math.round(Number(this.repaymentAmount) || 0));
    this.cdr.markForCheck();
  }

  submitRepayment(): void {
    const occurredAt = this.repaymentDate;
    const amount = Math.round(Number(this.repaymentAmount) || 0);

    if (!occurredAt) {
      this.repaymentError = 'Seleccioná una fecha.';
      this.cdr.markForCheck();
      return;
    }

    if (amount <= 0) {
      this.repaymentError = 'El monto debe ser mayor a cero.';
      this.cdr.markForCheck();
      return;
    }

    if (amount > this.repaymentDebtorAmount) {
      this.repaymentError = `El monto supera la deuda pendiente (${this.repaymentDebtorAmount}).`;
      this.cdr.markForCheck();
      return;
    }

    this.repaymentSaving = true;
    this.repaymentError = '';
    this.cdr.markForCheck();

    this.treasuryService
      .createExpense({
        isSupplyPurchase: false,
        category: TreasuryExpenseCategory.LOAN_REPAYMENT,
        name: this.repaymentDebtorName,
        amount,
        occurredAt,
      })
      .pipe(
        finalize(() => {
          this.repaymentSaving = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: () => {
          this.closeRepaymentForm();
          this.refreshOverview();
        },
        error: (err) => {
          this.repaymentError = extractApiErrorMessage(
            err,
            'No se pudo registrar la devolución',
          );
          this.cdr.markForCheck();
        },
      });
  }

  onSupplyPurchaseToggle(): void {
    if (this.isSupplyPurchase) {
      this.name = '';
    } else {
      this.supplyLines = [];
      this.selectedSupplyId = '';
    }
    this.syncAmount();
    this.cdr.markForCheck();
  }

  setMovementDirection(direction: TreasuryMovementDirection): void {
    this.movementDirection = direction;
    this.cdr.markForCheck();
  }

  get isIncomeMovement(): boolean {
    return this.movementDirection === TreasuryMovementDirection.INCOME;
  }

  addSupplyLine(): void {
    const supply = this.supplies.find((item) => item.id === this.selectedSupplyId);
    if (!supply) return;

    this.addSupplyLineFromSupply(supply);
    this.selectedSupplyId = '';
    this.cdr.markForCheck();
  }

  openCreateSupply(): void {
    this.formDialogs.openSupply(null).subscribe((saved) => {
      if (!saved) return;
      this.addSupplyLineFromSupply(saved);
      this.cdr.markForCheck();
    });
  }

  private addSupplyLineFromSupply(supply: Supply): void {
    if (this.supplyLines.some((line) => line.supplyId === supply.id)) {
      return;
    }

    this.supplyLines = [
      ...this.supplyLines,
      {
        supplyId: supply.id,
        supplyName: supply.name,
        unit: supply.unit,
        quantity: 1,
        amountSpent: Math.round(supply.unitPrice || 0),
        unitPrice: Math.round(supply.unitPrice || 0),
      },
    ];
    this.syncAmount();
  }

  removeSupplyLine(supplyId: string): void {
    this.supplyLines = this.supplyLines.filter(
      (line) => line.supplyId !== supplyId,
    );
    this.syncAmount();
    this.cdr.markForCheck();
  }

  onSupplyLineChange(line: WalletSupplyLine): void {
    line.quantity = Math.max(0, Number(line.quantity) || 0);
    line.amountSpent = Math.max(0, Math.round(Number(line.amountSpent) || 0));
    line.unitPrice = Math.max(0, Math.round(Number(line.unitPrice) || 0));
    this.syncAmount();
    this.cdr.markForCheck();
  }

  onSimpleAmountChange(): void {
    this.amount = Math.max(0, Math.round(Number(this.amount) || 0));
    this.cdr.markForCheck();
  }

  supplyLineDelta(line: WalletSupplyLine): number {
    return computeSupplyPurchaseDelta(
      line.amountSpent,
      line.quantity,
      line.unitPrice,
    );
  }

  supplyLineListTotal(line: WalletSupplyLine): number {
    return Math.round(line.quantity * line.unitPrice);
  }

  submitExpense(): void {
    const occurredAt = this.expenseDate;
    const payloadAmount = this.isSupplyPurchase
      ? this.computedSupplyTotal
      : Math.round(Number(this.amount) || 0);

    if (!occurredAt) {
      this.formError = 'Seleccioná una fecha.';
      this.cdr.markForCheck();
      return;
    }

    if (payloadAmount <= 0) {
      this.formError = 'El monto debe ser mayor a cero.';
      this.cdr.markForCheck();
      return;
    }

    if (!this.isSupplyPurchase && !this.isPersonMovementForm && !this.name.trim()) {
      this.formError = 'Ingresá un nombre para el registro.';
      this.cdr.markForCheck();
      return;
    }

    if (this.isPersonMovementForm && !this.recipientName.trim()) {
      this.formError = 'Ingresá la persona destinataria.';
      this.cdr.markForCheck();
      return;
    }

    if (this.isSupplyPurchase && !this.supplyLines.length) {
      this.formError = 'Agregá al menos un insumo.';
      this.cdr.markForCheck();
      return;
    }

    this.saving = true;
    this.formError = '';
    this.cdr.markForCheck();

    this.treasuryService
      .createExpense({
        isSupplyPurchase: this.isSupplyPurchase,
        direction: this.isSupplyPurchase || this.isPersonMovementForm
          ? undefined
          : this.movementDirection,
        category: this.isPersonMovementForm
          ? this.formMode === 'payment'
            ? TreasuryExpenseCategory.PAYMENT
            : TreasuryExpenseCategory.LOAN
          : undefined,
        name: this.isSupplyPurchase
          ? undefined
          : this.isPersonMovementForm
            ? this.recipientName.trim()
            : this.name.trim(),
        amount: payloadAmount,
        occurredAt,
        supplyLines: this.isSupplyPurchase
          ? this.supplyLines.map((line) => ({
              supplyId: line.supplyId,
              quantity: line.quantity,
              amountSpent: line.amountSpent,
              unitPrice: line.unitPrice,
            }))
          : undefined,
      })
      .pipe(
        finalize(() => {
          this.saving = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: () => {
          this.closeForm();
          this.refreshOverview();
          this.suppliesService.refreshSupplies().subscribe();
        },
        error: (err) => {
          this.formError = extractApiErrorMessage(
            err,
            'No se pudo guardar el registro',
          );
          this.cdr.markForCheck();
        },
      });
  }

  expenseDateLabel(expense: TreasuryExpense): string {
    return new Date(expense.occurredAt).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  recordTypeLabel(expense: TreasuryExpense): string {
    if (expense.category === TreasuryExpenseCategory.SUPPLY_PURCHASE) {
      return 'Compra de insumos';
    }
    if (expense.category === TreasuryExpenseCategory.PAYMENT) {
      return 'Pago';
    }
    if (expense.category === TreasuryExpenseCategory.LOAN) {
      return 'Préstamo';
    }
    if (expense.category === TreasuryExpenseCategory.LOAN_REPAYMENT) {
      return 'Devolución';
    }
    return expense.direction === TreasuryMovementDirection.INCOME
      ? 'Ingreso'
      : 'Egreso';
  }

  isIncomeRecord(expense: TreasuryExpense): boolean {
    return expense.direction === TreasuryMovementDirection.INCOME;
  }

  isExpenseRecord(expense: TreasuryExpense): boolean {
    return expense.direction === TreasuryMovementDirection.EXPENSE;
  }

  recordDisplayAmount(expense: TreasuryExpense): number {
    return this.isExpenseRecord(expense) ? -expense.amount : expense.amount;
  }

  supplyPurchaseSavings(expense: TreasuryExpense): number | null {
    if (expense.category !== TreasuryExpenseCategory.SUPPLY_PURCHASE) {
      return null;
    }

    const savings = -computeSupplyPurchaseDelta(
      expense.amount,
      expense.quantity,
      expense.unitPrice,
    );
    return savings > 0 ? savings : null;
  }

  private resetForm(mode: WalletFormMode = 'general'): void {
    this.formMode = mode;
    this.isSupplyPurchase = false;
    this.movementDirection = TreasuryMovementDirection.EXPENSE;
    this.name = '';
    this.recipientName = '';
    this.amount = 0;
    this.expenseDate = WalletComponent.todayInputValue();
    this.selectedSupplyId = '';
    this.supplyLines = [];
    this.formError = '';
  }

  private syncAmount(): void {
    if (this.isSupplyPurchase) {
      this.amount = this.computedSupplyTotal;
    }
  }

  private static todayInputValue(): string {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${now.getFullYear()}-${month}-${day}`;
  }
}
