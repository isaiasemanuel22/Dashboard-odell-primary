import {
  ChangeDetectionStrategy,
  Component,
  input,
} from '@angular/core';

export interface MobileContactPill {
  label: string;
  className?: string;
}

/**
 * Tarjeta de contacto mobile: avatar opcional, nombre, pills y
 * acciones WhatsApp / Llamar.
 */
@Component({
  selector: 'db-mobile-contact-card',
  standalone: true,
  templateUrl: './mobile-contact-card.component.html',
  styleUrl: './mobile-contact-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileContactCardComponent {
  readonly name = input('');
  readonly initials = input<string | null>(null);
  readonly pills = input<MobileContactPill[]>([]);
  readonly whatsappHref = input<string | null>(null);
  readonly telHref = input<string | null>(null);
  /** Si false, no envuelve en m-card (útil dentro de otra tarjeta). */
  readonly card = input(true);
  readonly centered = input(false);
  /** Si false, solo muestra las acciones (pedido ya tiene el nombre arriba). */
  readonly showIdentity = input(true);

  get showActions(): boolean {
    return !!(this.whatsappHref() || this.telHref());
  }
}
