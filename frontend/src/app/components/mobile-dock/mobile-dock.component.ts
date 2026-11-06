import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  HostBinding,
  Input,
  Output,
} from '@angular/core';

export interface MobileDockAction {
  id: string;
  label: string;
  kind: 'primary' | 'secondary';
  disabled?: boolean;
  loading?: boolean;
  ariaLabel?: string;
}

@Component({
  selector: 'db-mobile-dock',
  standalone: true,
  templateUrl: './mobile-dock.component.html',
  styleUrl: './mobile-dock.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileDockComponent {
  @Input() actions: MobileDockAction[] = [];
  /** Si es true, el botón secondary mide 120px fijos en lugar de flex: 1. */
  @Input() secondaryFixed = false;
  /** Pie de hoja: sin fixed ni z-index propios (vive dentro de `db-mobile-sheet`). */
  @Input() embedded = false;
  @Output() readonly action = new EventEmitter<string>();

  @HostBinding('class.m-dock--secondary-fixed')
  get hostSecondaryFixed(): boolean {
    return this.secondaryFixed;
  }

  @HostBinding('class.m-dock--embedded')
  get hostEmbedded(): boolean {
    return this.embedded;
  }

  onAction(item: MobileDockAction): void {
    if (item.disabled || item.loading) return;
    this.action.emit(item.id);
  }
}
