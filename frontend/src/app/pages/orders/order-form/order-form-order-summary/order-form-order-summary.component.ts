import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  DbInputComponent,
  DbSegmentedControlComponent,
  DbSelectComponent,
  DbSegmentOption,
  DbSelectOption,
} from '@general-components';
import {
  MobileChipGroupComponent,
  MobileChipOption,
} from '../../../../components/mobile-chip-group/mobile-chip-group.component';
import { PaymentMethod } from '../../../../core/models';
import { CurrencyArsPipe } from '../../../../shared/pipes/labels.pipe';
import { DiscountMode } from '../../../../shared/utils/discount.util';
import { OrderFormDiscountComponent } from '../order-form-discount/order-form-discount.component';

export type OrderFormDepositMode = 'editable' | 'info' | 'none';

@Component({
  selector: 'app-order-form-order-summary',
  standalone: true,
  imports: [
    FormsModule,
    CurrencyArsPipe,
    DbInputComponent,
    DbSelectComponent,
    DbSegmentedControlComponent,
    MobileChipGroupComponent,
    OrderFormDiscountComponent,
  ],
  templateUrl: './order-form-order-summary.component.html',
  styleUrl: './order-form-order-summary.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
})
export class OrderFormOrderSummaryComponent {
  private static nextDepositId = 0;
  readonly depositAmountId = `deposit-amount-${++OrderFormOrderSummaryComponent.nextDepositId}`;

  @Input() listSubtotal = 0;
  @Input() wholesalePercent = 0;
  @Input() wholesaleDiscountAmount = 0;
  @Input() wholesaleProductsBase = 0;
  @Input() wholesaleApplied = false;
  @Input() resellerSavings = 0;

  @Input() discountMode: DiscountMode = 'none';
  @Input() discountPercent = 0;
  @Input() discountAmount = 0;
  @Input() discountPercentMax = 99;
  @Input() discountAmountMax = 0;
  @Input() discountHint = '';
  @Input() discountApplied = 0;
  /** Pedidos muestran descuento manual; presupuestos también. */
  @Input() showDiscount = true;

  @Input() total = 0;
  @Input() totalCost = 0;
  @Input() paymentFee = 0;
  /** Comisión del medio: solo en alta de pedido con seña editable. */
  @Input() showPaymentFee = true;
  @Input() profit = 0;
  /** Hay líneas de Servicio/Diseño/Modelado sin costo: la ganancia no es real. */
  @Input() costIncomplete = false;
  @Input() profitPercentOnCost = 0;
  @Input() listProfit = 0;

  /**
   * Seña: editable (pedido nuevo), solo lectura informativa (presupuesto)
   * o oculta (editar pedido).
   */
  @Input() depositMode: OrderFormDepositMode = 'none';
  @Input() depositAmount: number | null = null;
  @Input() depositSuggested = 0;
  @Input() depositPercent = 50;
  @Input() depositMethod: PaymentMethod = PaymentMethod.EFECTIVO;
  @Input() depositMethodOptions: DbSegmentOption<PaymentMethod>[] = [];
  @Input() depositAccount = '';
  @Input() depositAccountOptions: DbSelectOption[] = [];
  @Input() depositFee: number | null = null;
  @Input() balanceAfterDeposit = 0;

  @Output() modeChange = new EventEmitter<DiscountMode>();
  @Output() percentChange = new EventEmitter<number | string>();
  @Output() amountChange = new EventEmitter<number | string>();

  @Output() depositAmountChange = new EventEmitter<number | null>();
  @Output() depositMethodChange = new EventEmitter<PaymentMethod>();
  @Output() depositAccountChange = new EventEmitter<string>();
  @Output() depositFeeChange = new EventEmitter<number | null>();

  /** Vista `$ 3.680` (mismo formateo que currencyArs). El modelo sigue numérico. */
  get depositAmountDisplay(): string {
    if (this.depositAmount == null || this.depositAmount === ('' as unknown)) {
      return '';
    }
    const amount = Math.round(Number(this.depositAmount) || 0);
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0,
    }).format(amount);
  }

  /** La ayuda «N% del total» solo si el monto coincide con la seña sugerida. */
  get isSuggestedDeposit(): boolean {
    if (this.depositAmount == null) return false;
    return Math.round(Number(this.depositAmount) || 0) === Math.round(Number(this.depositSuggested) || 0);
  }

  get depositChipOptions(): MobileChipOption<PaymentMethod>[] {
    return this.depositMethodOptions.map((opt) => ({
      value: opt.value,
      label: opt.label,
    }));
  }

  onDepositAmountDisplayChange(raw: string): void {
    const digits = String(raw ?? '').replace(/\D/g, '');
    if (!digits) {
      this.depositAmountChange.emit(null);
      return;
    }
    this.depositAmountChange.emit(Math.round(Number(digits)));
  }

  useSuggestedDeposit(): void {
    this.depositAmountChange.emit(Math.round(Number(this.depositSuggested) || 0));
  }

  onDepositChipChange(value: PaymentMethod | null): void {
    if (value == null) return;
    this.depositMethodChange.emit(value);
  }
}
