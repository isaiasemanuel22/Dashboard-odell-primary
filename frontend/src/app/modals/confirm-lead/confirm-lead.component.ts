import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

export type ConfirmTone = 'danger' | 'info';

/**
 * Cabecera de las confirmaciones (RdPatrones §2): ícono en cuadro redondeado,
 * título y mensaje. Lo que se proyecte con `[confirmFields]` va debajo,
 * alineado con el texto. En mobile el título sube a la cabecera de la hoja
 * y queda el ícono con el mensaje (MobRdConfirmacion).
 */
@Component({
  selector: 'app-confirm-lead',
  standalone: true,
  templateUrl: './confirm-lead.component.html',
  styleUrl: './confirm-lead.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmLeadComponent {
  @Input() tone: ConfirmTone = 'info';
  @Input() title = '';
}
