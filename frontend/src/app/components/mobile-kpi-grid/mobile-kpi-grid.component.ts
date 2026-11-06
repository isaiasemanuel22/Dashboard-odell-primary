import {
  ChangeDetectionStrategy,
  Component,
  input,
} from '@angular/core';
import { RouterLink } from '@angular/router';

export interface MobileKpiItem {
  label: string;
  value: string;
  hint?: string | null;
  tone?: 'default' | 'success' | 'danger';
  link?: string | any[] | null;
  fragment?: string | null;
}

/**
 * Grilla de KPIs mobile (por defecto 2 columnas). Ítems con link
 * se renderizan como ancla.
 */
@Component({
  selector: 'db-mobile-kpi-grid',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './mobile-kpi-grid.component.html',
  styleUrl: './mobile-kpi-grid.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileKpiGridComponent {
  readonly items = input<MobileKpiItem[]>([]);
  readonly cols = input(2);
  readonly ariaLabel = input('Indicadores');
}
