import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Clave de área/servicio. Acepta los ids de tabla (`impresion3d`) y
 * los `ServiceType` del dominio (`impresion_3d`).
 */
export type DbAreaChipKey =
  | 'impresion_3d'
  | 'impresion3d'
  | 'diseno_grafico'
  | 'diseno'
  | 'modelado'
  | 'estampado'
  | 'general'
  | (string & {});

@Component({
  selector: 'db-area-chip',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span [class]="classes()">{{ label() }}</span>`,
  styleUrl: './db-area-chip.component.scss',
})
export class DbAreaChipComponent {
  /** Texto visible del chip. */
  readonly label = input.required<string>();
  /** Área/servicio que define el color. */
  readonly area = input<DbAreaChipKey>('general');
  /**
   * `soft` = fondo tintado (mock de badges de servicio).
   * `outline` = solo borde/texto coloreados.
   */
  readonly tone = input<'soft' | 'outline'>('soft');

  readonly classes = computed(() => {
    const key = normalizeAreaKey(this.area());
    return [
      'db-area-chip',
      `db-area-chip--${this.tone()}`,
      `db-area-chip--${key}`,
    ].join(' ');
  });
}

function normalizeAreaKey(area: string): string {
  switch (area) {
    case 'impresion_3d':
    case 'impresion3d':
    case '3d':
      return 'impresion3d';
    case 'diseno_grafico':
    case 'diseno':
    case 'diseño':
      return 'diseno';
    case 'modelado':
      return 'modelado';
    case 'estampado':
      return 'estampado';
    default:
      return 'general';
  }
}
