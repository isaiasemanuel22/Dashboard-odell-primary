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
  @Output() readonly action = new EventEmitter<string>();

  @HostBinding('class.m-dock--secondary-fixed')
  get hostSecondaryFixed(): boolean {
    return this.secondaryFixed;
  }

  onAction(item: MobileDockAction): void {
    if (item.disabled || item.loading) return;
    this.action.emit(item.id);
  }
}
