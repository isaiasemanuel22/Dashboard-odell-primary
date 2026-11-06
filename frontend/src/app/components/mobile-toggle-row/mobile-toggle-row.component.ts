import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';

/**
 * Fila con interruptor mobile (`role="switch"` + `aria-checked`).
 */
@Component({
  selector: 'db-mobile-toggle-row',
  standalone: true,
  templateUrl: './mobile-toggle-row.component.html',
  styleUrl: './mobile-toggle-row.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileToggleRowComponent {
  readonly label = input.required<string>();
  readonly hint = input<string | null>(null);
  readonly checked = input(false);
  readonly ariaLabel = input<string | null>(null);
  /** `row` = m-row con subtítulo; `line` = m-ln compacto (ej. Ganancias). */
  readonly variant = input<'row' | 'line'>('row');

  readonly toggled = output<boolean>();

  protected onToggle(): void {
    this.toggled.emit(!this.checked());
  }
}
