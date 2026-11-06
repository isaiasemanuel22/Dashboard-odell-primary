import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable, finalize } from 'rxjs';
import {
  Supply,
  TreasuryAccount,
  TreasuryAccountBalance,
  TreasuryExpense,
  TreasuryExpenseCategory,
  TreasuryMovementDirection,
  UpdateTreasuryExpensePayload,
} from '../../../../core/models';
import { SuppliesService } from '../../../../core/services/settings.service';
import { TreasuryService } from '../../../../core/services/treasury.service';
import {
  DbAutocompleteComponent,
  DbButtonComponent,
  DbFormGridComponent,
  DbFormGridFullComponent,
  DbInputComponent,
  DbSelectComponent,
  FormModalComponent,
  MobileAmountInputComponent,
} from '@general-components';
import type { DbAutocompleteOption } from '@dashboard-form/db-autocomplete/db-autocomplete.types';
import type { DbSelectOption } from '@dashboard-form/db-select/db-select.types';
import { CurrencyArsPipe } from '../../../../shared/pipes/labels.pipe';
import { extractApiErrorMessage } from '../../../../shared/utils/api-error';
import { FormDialogService } from '../../../../modals/form-dialog.service';
import { labelsToSelectOptions } from '../../../../shared/utils/select-options';
import { TREASURY_ACCOUNT_LABELS } from '../../../../shared/utils/v1-labels.util';
import { formatCurrencyArs } from '../../../../shared/utils/currency-ars.util';
import { formatMobileDateLabel } from '../../../../shared/utils/mobile-date-label.util';
import { BreakpointService } from '../../../../core/services/breakpoint.service';
import {
  WalletRecordSuppliesComponent,
  WalletSupplyLine,
} from './wallet-record-supplies/wallet-record-supplies.component';

export type WalletFormMode = 'general' | 'payment' | 'loan';

@Component({
  selector: 'app-wallet-record-form',
  standalone: true,
  imports: [
    FormsModule,
    CurrencyArsPipe,
    DbButtonComponent,
    DbInputComponent,
    DbSelectComponent,
    DbFormGridComponent,
    DbFormGridFullComponent,
    DbAutocompleteComponent,
    FormModalComponent,
    MobileAmountInputComponent,
    WalletRecordSuppliesComponent,
  ],
  templateUrl: './wallet-record-form.component.html',
  styleUrl: '../wallet-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WalletRecordFormComponent implements OnInit {
  private readonly treasuryService = inject(TreasuryService);
  private readonly suppliesService = inject(SuppliesService);
  private readonly formDialogs = inject(FormDialogService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly breakpoint = inject(BreakpointService);

  @Input() mode: WalletFormMode = 'general';
  @Input() expense: TreasuryExpense | null = null;
  @Input() startAsPurchase = false;
  @Input() supplies: Supply[] = [];
  @Input() accountBalances: TreasuryAccountBalance[] = [];
  @Input() nameSuggestions: string[] = [];
  @Input() recipientSuggestions: string[] = [];
  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  readonly movementDirections = TreasuryMovementDirection;
  readonly maxExpenseDate = WalletRecordFormComponent.todayInputValue();
  readonly accountOptions: DbSelectOption[] =
    labelsToSelectOptions(TREASURY_ACCOUNT_LABELS);

  saving = false;
  formError = '';
  isSupplyPurchase = false;
  movementDirection: TreasuryMovementDirection = TreasuryMovementDirection.EXPENSE;
  name = '';
  recipientName = '';
  amount = 0;
  account: TreasuryAccount = TreasuryAccount.CAJA;
  expenseDate = WalletRecordFormComponent.todayInputValue();
  selectedSupplyId = '';
  supplyLines: WalletSupplyLine[] = [];

  ngOnInit(): void {
    if (this.expense) {
      this.prefill(this.expense);
      return;
    }
    if (this.startAsPurchase) this.isSupplyPurchase = true;
  }

  get isEdit(): boolean {
    return !!this.expense;
  }

  get isRepayment(): boolean {
    return this.expense?.category === TreasuryExpenseCategory.LOAN_REPAYMENT;
  }

  /** Compra vieja sin insumo vinculado: se corrige el dinero, no el stock. */
  get isUnlinkedSupplyPurchase(): boolean {
    return (
      this.expense?.category === TreasuryExpenseCategory.SUPPLY_PURCHASE &&
      !this.expense.referenceId
    );
  }

  get formTitle(): string {
    if (this.isEdit) {
      if (this.isSupplyPurchase) return 'Editar compra';
      if (this.isUnlinkedSupplyPurchase) return 'Editar compra';
      if (this.mode === 'payment') return 'Editar pago';
      if (this.mode === 'loan') return 'Editar préstamo';
      if (this.isRepayment) return 'Editar devolución';
      return 'Editar registro';
    }
    switch (this.mode) {
      case 'payment':
        return 'Pagar';
      case 'loan':
        return 'Prestar';
      default:
        return 'Agregar registro';
    }
  }

  get personHeading(): string {
    if (this.isRepayment) return 'Devolución';
    return this.mode === 'payment' ? 'Pago' : 'Préstamo';
  }

  get personHelp(): string {
    if (this.isRepayment) {
      return 'Corregí la persona o el monto que vuelve a la billetera.';
    }
    return this.mode === 'payment'
      ? 'Registrá un egreso por pago entregado a una persona.'
      : 'Registrá un egreso por dinero prestado a una persona.';
  }

  get personSummaryLabel(): string {
    if (this.isRepayment) return 'Devolución a registrar';
    return this.mode === 'payment' ? 'Pago a registrar' : 'Préstamo a registrar';
  }

  get isPersonMovementForm(): boolean {
    return this.mode === 'payment' || this.mode === 'loan' || this.isRepayment;
  }

  get isIncomeMovement(): boolean {
    return this.movementDirection === TreasuryMovementDirection.INCOME;
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

  get nameOptions(): DbAutocompleteOption[] {
    return this.nameSuggestions.map((name) => ({ value: name, label: name }));
  }

  get recipientOptions(): DbAutocompleteOption[] {
    return this.recipientSuggestions.map((name) => ({ value: name, label: name }));
  }

  get mobileDateLabel(): string {
    return formatMobileDateLabel(this.expenseDate);
  }

  get submitLabel(): string {
    if (this.saving) return 'Guardando...';
    if (this.isEdit) return 'Guardar cambios';
    const base =
      this.mode === 'payment'
        ? 'Registrar pago'
        : this.mode === 'loan'
          ? 'Registrar préstamo'
          : 'Guardar registro';
    if (!this.breakpoint.isMobile()) return base;
    const amount = this.isSupplyPurchase
      ? this.computedSupplyTotal
      : Math.round(Number(this.amount) || 0);
    if (amount <= 0) return this.mode === 'payment' || this.mode === 'loan' ? base : 'Guardar';
    if (this.mode === 'payment') return `Registrar pago ${formatCurrencyArs(amount)}`;
    if (this.mode === 'loan') return `Registrar préstamo ${formatCurrencyArs(amount)}`;
    return `Guardar ${formatCurrencyArs(amount)}`;
  }

  accountBalance(account: TreasuryAccount): number {
    const entry = this.accountBalances.find((item) => item.account === account);
    return entry?.balance ?? 0;
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

  removeSupplyLine(supplyId: string): void {
    this.supplyLines = this.supplyLines.filter((line) => line.supplyId !== supplyId);
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
      this.formError = this.isRepayment
        ? 'Ingresá la persona que devuelve.'
        : 'Ingresá la persona destinataria.';
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

    const request: Observable<unknown> = this.expense
      ? this.treasuryService.updateExpense(
          this.expense.id,
          this.buildUpdatePayload(payloadAmount, occurredAt),
        )
      : this.treasuryService.createExpense({
          isSupplyPurchase: this.isSupplyPurchase,
          direction: this.isSupplyPurchase || this.isPersonMovementForm
            ? undefined
            : this.movementDirection,
          category: this.isPersonMovementForm
            ? this.mode === 'payment'
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
          account: this.account,
          supplyLines: this.isSupplyPurchase
            ? this.supplyLines.map((line) => ({
                supplyId: line.supplyId,
                quantity: line.quantity,
                amountSpent: line.amountSpent,
                unitPrice: line.unitPrice,
              }))
            : undefined,
        });

    request
      .pipe(
        finalize(() => {
          this.saving = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: () => {
          this.suppliesService.refreshSupplies().subscribe();
          this.saved.emit();
        },
        error: (err) => {
          this.formError = extractApiErrorMessage(err, 'No se pudo guardar el registro');
          this.cdr.markForCheck();
        },
      });
  }

  private buildUpdatePayload(
    amount: number,
    occurredAt: string,
  ): UpdateTreasuryExpensePayload {
    if (this.isSupplyPurchase) {
      const line = this.supplyLines[0];
      return {
        amount,
        occurredAt,
        quantity: line?.quantity,
        unitPrice: line?.unitPrice,
        account: this.account,
      };
    }

    if (this.isPersonMovementForm || this.isUnlinkedSupplyPurchase) {
      return {
        name: this.isPersonMovementForm
          ? this.recipientName.trim()
          : this.name.trim(),
        amount,
        occurredAt,
        account: this.account,
      };
    }

    return {
      name: this.name.trim(),
      amount,
      occurredAt,
      direction: this.movementDirection,
      account: this.account,
    };
  }

  private prefill(expense: TreasuryExpense): void {
    this.expenseDate = this.toDateInput(expense.occurredAt);
    this.amount = expense.amount;
    this.movementDirection = expense.direction;
    this.account = expense.account ?? TreasuryAccount.CAJA;

    if (
      expense.category === TreasuryExpenseCategory.SUPPLY_PURCHASE &&
      expense.referenceId
    ) {
      this.isSupplyPurchase = true;
      const supply = this.supplies.find((item) => item.id === expense.referenceId);
      this.supplyLines = [
        {
          supplyId: expense.referenceId,
          supplyName: supply?.name ?? expense.name,
          unit: supply?.unit ?? 'u',
          quantity: expense.quantity,
          amountSpent: expense.amount,
          unitPrice: expense.unitPrice,
        },
      ];
      return;
    }

    if (
      expense.category === TreasuryExpenseCategory.PAYMENT ||
      expense.category === TreasuryExpenseCategory.LOAN ||
      expense.category === TreasuryExpenseCategory.LOAN_REPAYMENT
    ) {
      this.recipientName = expense.name;
      return;
    }

    this.name = expense.name;
  }

  private toDateInput(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso.slice(0, 10);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
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
