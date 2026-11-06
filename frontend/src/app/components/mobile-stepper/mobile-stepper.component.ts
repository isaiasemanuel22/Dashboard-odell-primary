import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';

@Component({
  selector: 'db-mobile-stepper',
  standalone: true,
  templateUrl: './mobile-stepper.component.html',
  styleUrl: './mobile-stepper.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileStepperComponent {
  @Input() value = 0;
  @Input() min = 0;
  /** Sin tope si es null. */
  @Input() max: number | null = null;
  @Input() step = 1;
  @Input() disabled = false;
  @Input() ariaLabel = 'Cantidad';
  @Input() decrementAriaLabel = 'Restar uno';
  @Input() incrementAriaLabel = 'Sumar uno';

  @Output() readonly valueChange = new EventEmitter<number>();

  get canDecrement(): boolean {
    return !this.disabled && this.value > this.min;
  }

  get canIncrement(): boolean {
    if (this.disabled) return false;
    if (this.max == null) return true;
    return this.value < this.max;
  }

  decrement(): void {
    if (!this.canDecrement) return;
    this.valueChange.emit(this.clamp(this.value - this.step));
  }

  increment(): void {
    if (!this.canIncrement) return;
    this.valueChange.emit(this.clamp(this.value + this.step));
  }

  private clamp(next: number): number {
    const rounded = Math.round(Number(next) || 0);
    const lower = Math.max(this.min, rounded);
    if (this.max == null) return lower;
    return Math.min(this.max, lower);
  }
}
