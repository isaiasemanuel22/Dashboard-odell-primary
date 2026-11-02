import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'db-nav-icon',
  standalone: true,
  templateUrl: './nav-icon.component.html',
  styleUrl: './nav-icon.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavIconComponent {
  @Input({ required: true }) name = '';

  /** Variantes `m-*` del artboard mobile usan stroke 1.8. */
  get strokeWidth(): number {
    return this.name.startsWith('m-') ? 1.8 : 1.75;
  }
}
