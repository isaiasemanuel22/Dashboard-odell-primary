import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { RouterLink } from '@angular/router';

export interface MobileNavItem {
  id?: string;
  label: string;
  hint?: string | null;
  link?: string | any[] | null;
  danger?: boolean;
  /** Si true, emite `action` en lugar de navegar. */
  action?: boolean;
}

export interface MobileNavGroup {
  title: string;
  items: MobileNavItem[];
}

/**
 * Índice mobile: grupos de filas con título, ayuda y link/chevron.
 */
@Component({
  selector: 'db-mobile-nav-list',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './mobile-nav-list.component.html',
  styleUrl: './mobile-nav-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileNavListComponent {
  readonly groups = input<MobileNavGroup[]>([]);

  readonly action = output<MobileNavItem>();

  protected onAction(item: MobileNavItem): void {
    this.action.emit(item);
  }
}
