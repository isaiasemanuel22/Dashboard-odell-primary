import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';

export type MobileMovementKind = 'income' | 'expense' | 'transfer';

/**
 * Fila de movimiento mobile (+/−/⇄, monto, comisión, anulado).
 */
@Component({
  selector: 'db-mobile-movement-row',
  standalone: true,
  templateUrl: './mobile-movement-row.component.html',
  styleUrl: './mobile-movement-row.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileMovementRowComponent {
  readonly title = input.required<string>();
  readonly detail = input<string | null>(null);
  readonly kind = input<MobileMovementKind>('income');
  readonly icon = input('+');
  /** Monto ya formateado (sin signo de egreso; el componente agrega −). */
  readonly amount = input<string | null>(null);
  readonly feeLabel = input<string | null>(null);
  readonly voided = input(false);
  readonly disabled = input(false);

  readonly pressed = output<void>();

  protected onPress(): void {
    if (this.disabled()) return;
    this.pressed.emit();
  }
}
