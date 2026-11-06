import {
  ChangeDetectionStrategy,
  Component,
  input,
} from '@angular/core';

export interface MobileTotalRow {
  label: string;
  value: string;
  /** 'muted' | 'danger' | 'success' | 'emphasis' (total destacado) */
  tone?: 'default' | 'muted' | 'danger' | 'success' | 'emphasis';
  /** Etiqueta en 12px secundario (hint), sin forzar el tono del valor. */
  labelHint?: boolean;
  strong?: boolean;
}

/**
 * Filas etiqueta/valor con total destacado. Layout `rows` (default) o
 * `cols` (Total/Pagado/Saldo en columnas).
 */
@Component({
  selector: 'db-mobile-totals',
  standalone: true,
  templateUrl: './mobile-totals.component.html',
  styleUrl: './mobile-totals.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileTotalsComponent {
  readonly rows = input<MobileTotalRow[]>([]);
  readonly layout = input<'rows' | 'cols'>('rows');
  readonly ariaLabel = input('Totales');
}
