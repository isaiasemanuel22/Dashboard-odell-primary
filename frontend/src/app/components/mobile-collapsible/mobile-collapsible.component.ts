import {
  ChangeDetectionStrategy,
  Component,
  input,
  model,
  output,
} from '@angular/core';

/**
 * Sección plegable mobile: título, resumen a la derecha, chevron,
 * aria-expanded. El cuerpo va por proyección.
 */
@Component({
  selector: 'db-mobile-collapsible',
  standalone: true,
  templateUrl: './mobile-collapsible.component.html',
  styleUrl: './mobile-collapsible.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileCollapsibleComponent {
  readonly title = input.required<string>();
  readonly summary = input<string | null>(null);
  readonly open = model(false);
  readonly panelId = input<string | null>(null);

  readonly toggled = output<boolean>();

  protected onToggle(): void {
    const next = !this.open();
    this.open.set(next);
    this.toggled.emit(next);
  }
}
