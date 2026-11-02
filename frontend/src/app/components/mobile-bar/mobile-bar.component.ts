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
}
