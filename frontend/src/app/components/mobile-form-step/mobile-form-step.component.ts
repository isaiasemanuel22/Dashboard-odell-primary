import {
  ChangeDetectionStrategy,
  Component,
  Input,
} from '@angular/core';

@Component({
  selector: 'db-mobile-form-step',
  standalone: true,
  templateUrl: './mobile-form-step.component.html',
  styleUrl: './mobile-form-step.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileFormStepComponent {
  /** Título numerado mobile, ej. «1 · Cliente». Vacío = sin encabezado. */
  @Input() title = '';
  /** Tarjeta sin padding (listas flush). */
  @Input() flush = false;
  /** Clase extra en la tarjeta (p. ej. campos de descripción). */
  @Input() cardClass = '';
}
