import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';

/**
 * Fila de catálogo mobile: swatch/avatar opcional, título, subtítulo,
 * valor a la derecha y proyección de acciones.
 */
@Component({
  selector: 'db-mobile-catalog-row',
  standalone: true,
  templateUrl: './mobile-catalog-row.component.html',
  styleUrl: './mobile-catalog-row.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileCatalogRowComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string | null>(null);
  /** Valor principal a la derecha (ya formateado). */
  readonly value = input<string | null>(null);
  readonly valueHint = input<string | null>(null);
  /** Iniciales de avatar circular. */
  readonly initials = input<string | null>(null);
  /** Color de swatch (hex o CSS). */
  readonly swatch = input<string | null>(null);
  /** Si es false, renderiza un div no interactivo. */
  readonly interactive = input(true);
  readonly disabled = input(false);

  readonly pressed = output<void>();

  protected onPress(): void {
    if (this.disabled()) return;
    this.pressed.emit();
  }
}
