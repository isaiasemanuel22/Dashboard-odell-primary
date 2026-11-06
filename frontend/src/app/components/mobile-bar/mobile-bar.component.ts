import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  inject,
} from '@angular/core';
import { Location } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LayoutUiService } from '../../layout/layout-ui.service';

@Component({
  selector: 'db-mobile-bar',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './mobile-bar.component.html',
  styleUrl: './mobile-bar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileBarComponent implements OnInit, OnDestroy {
  private readonly layoutUi = inject(LayoutUiService);
  private readonly location = inject(Location);

  @Input({ required: true }) title = '';
  @Input() backLink?: string | any[];
  @Input() showMenu = false;
  /** Si está definido, muestra una X a la izquierda y emite `close` (tiene prioridad sobre backLink/menú). */
  @Input() closeAriaLabel?: string;
  @Output() readonly close = new EventEmitter<void>();

  ngOnInit(): void {
    this.layoutUi.registerPageBar();
  }

  ngOnDestroy(): void {
    this.layoutUi.unregisterPageBar();
  }

  openMenu(): void {
    this.layoutUi.openNav();
  }

  onClose(): void {
    this.close.emit();
  }

  /**
   * Si hay historial interno de la app, vuelve atrás (Cola → detalle → origen).
   * Si se entró directo (sin historial útil), usa `backLink` como fallback.
   */
  onBack(event: Event): void {
    if (!this.canUseHistoryBack()) return;
    event.preventDefault();
    this.location.back();
  }

  private canUseHistoryBack(): boolean {
    if (typeof window === 'undefined') return false;
    // history.length > 1: hay algo a lo que volver dentro de la sesión.
    return window.history.length > 1;
  }
}
