import {
  ChangeDetectionStrategy,
  Component,
  input,
} from '@angular/core';

/**
 * Grupo de campo mobile: label + control con prefijo/sufijo opcionales
 * ($ / unidad). El input u otro control va por proyección.
 */
@Component({
  selector: 'db-mobile-field-group',
  standalone: true,
  templateUrl: './mobile-field-group.component.html',
  styleUrl: './mobile-field-group.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileFieldGroupComponent {
  readonly label = input<string | null>(null);
  readonly labelFor = input<string | null>(null);
  readonly prefix = input<string | null>(null);
  readonly suffix = input<string | null>(null);
  readonly hint = input<string | null>(null);
  readonly hintTone = input<'default' | 'danger'>('default');
}
