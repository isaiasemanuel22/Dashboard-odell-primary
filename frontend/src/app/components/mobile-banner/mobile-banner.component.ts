import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';

/**
 * Aviso mobile con ícono, texto y acción opcional
 * (precios desactualizados, stock bajo, etc.).
 */
@Component({
  selector: 'db-mobile-banner',
  standalone: true,
  templateUrl: './mobile-banner.component.html',
  styleUrl: './mobile-banner.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileBannerComponent {
  /** Título en negrita; si falta, solo se muestra `text`. */
  readonly title = input<string | null>(null);
  readonly text = input<string | null>(null);
  readonly actionLabel = input<string | null>(null);
  readonly showIcon = input(true);
  readonly tone = input<'warn' | 'info'>('warn');

  readonly action = output<void>();

  protected onAction(): void {
    this.action.emit();
  }
}
