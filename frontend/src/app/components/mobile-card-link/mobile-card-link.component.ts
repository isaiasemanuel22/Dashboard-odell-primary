import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Fila clickable de lista mobile: avatar/iniciales opcionales, título,
 * subtítulo y trailing (monto, pill o chevron). Pedidos/productos siguen
 * con su tarjeta propia.
 */
@Component({
  selector: 'db-mobile-card-link',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './mobile-card-link.component.html',
  styleUrl: './mobile-card-link.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileCardLinkComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string | null>(null);
  /** Iniciales del avatar circular. */
  readonly initials = input<string | null>(null);
  /** URL de imagen; tiene prioridad sobre initials. */
  readonly imageUrl = input<string | null>(null);
  readonly imageAlt = input('');
  /** Ruta de RouterLink; si falta, renderiza botón. */
  readonly link = input<string | any[] | null>(null);
  /** Muestra chevron a la derecha (si no hay proyección trailing). */
  readonly showChevron = input(false);
  /** Monto / valor a la derecha (texto ya formateado). */
  readonly trailing = input<string | null>(null);
  readonly trailingHint = input<string | null>(null);
  readonly trailingTone = input<'default' | 'danger'>('default');
  /** Clase pill opcional (ej. m-pill m-pill--b). */
  readonly pillClass = input<string | null>(null);
  readonly pillLabel = input<string | null>(null);
  /**
   * Nombre accesible del enlace/botón. Si falta, se arma con título,
   * subtítulo, pill y trailing.
   */
  readonly ariaLabel = input<string | null>(null);

  readonly pressed = output<void>();

  protected resolvedAriaLabel(): string {
    const custom = this.ariaLabel()?.trim();
    if (custom) return custom;
    const parts = [this.title()];
    const sub = this.subtitle()?.trim();
    if (sub) parts.push(sub);
    const pill = this.pillLabel()?.trim();
    if (pill) parts.push(pill);
    const trailing = this.trailing()?.trim();
    if (trailing) parts.push(trailing);
    return parts.join(', ');
  }

  protected onPress(): void {
    this.pressed.emit();
  }
}
