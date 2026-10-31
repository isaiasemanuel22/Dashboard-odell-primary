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
import { finalize } from 'rxjs';
import {
  Supply,
  TreasuryExpenseCategory,
  TreasuryMovementDirection,
} from '../../../../core/models';
import { SuppliesService } from '../../../../core/services/settings.service';
import { TreasuryService } from '../../../../core/services/treasury.service';
import {
  DbAutocompleteComponent,
  DbButtonComponent,
  DbFormGridComponent,
  DbFormGridFullComponent,
  DbInputComponent,
  FormModalComponent,
} from '@general-components';
import type { DbAutocompleteOption } from '@dashboard-form/db-autocomplete/db-autocomplete.types';
import { CurrencyArsPipe } from '../../../../shared/pipes/labels.pipe';
import { extractApiErrorMessage } from '../../../../shared/utils/api-error';
import { FormDialogService } from '../../../../shared/form-dialogs/form-dialog.service';
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
    DbFormGridComponent,
    DbFormGridFullComponent,
    DbAutocompleteComponent,
    FormModalComponent,
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

  @Input() mode: WalletFormMode = 'general';
  @Input() startAsPurchase = false;
  @Input() supplies: Supply[] = [];
  @Input() nameSuggestions: string[] = [];
  @Input() recipientSuggestions: string[] = [];
  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  readonly movementDirections = TreasuryMovementDirection;
  readonly maxExpenseDate = WalletRecordFormComponent.todayInputValue();

  saving = false;
  formError = '';
  isSupplyPurchase = false;
  movementDirection: TreasuryMovementDirection = TreasuryMovementDirection.EXPENSE;
  name = '';
  recipientName = '';
  amount = 0;
  expenseDate = WalletRecordFormComponent.todayInputValue();
  selectedSupplyId = '';
  supplyLines: WalletSupplyLine[] = [];

  ngOnInit(): void {
    if (this.startAsPurchase) this.isSupplyPurchase = true;
  }

  get formTitle(): string {
    switch (this.mode) {
      case 'payment':
        return 'Pagar';
      case 'loan':
        return 'Prestar';
      default:
        return 'Agregar registro';
    }
  }

  get isPersonMovementForm(): boolean {
    return this.mode === 'payment' || this.mode === 'loan';
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
          this.suppliesService.refreshSupplies().subscribe();
          this.saved.emit();
        },
        error: (err) => {
          this.formError = extractApiErrorMessage(err, 'No se pudo guardar el registro');
          this.cdr.markForCheck();
        },
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
