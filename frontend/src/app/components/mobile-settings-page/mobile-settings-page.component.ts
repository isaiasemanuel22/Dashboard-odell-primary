import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import {
  MobileDockAction,
  MobileDockComponent,
} from '../mobile-dock/mobile-dock.component';
import { MobileBarComponent } from '../mobile-bar/mobile-bar.component';

/**
 * Shell de subpantalla de ajustes: barra con volver, cuerpo y dock opcional.
 * Slot `[barAction]` en la barra; `[tabs]` entre barra y cuerpo.
 */
@Component({
  selector: 'db-mobile-settings-page',
  standalone: true,
  imports: [MobileBarComponent, MobileDockComponent],
  templateUrl: './mobile-settings-page.component.html',
  styleUrl: './mobile-settings-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileSettingsPageComponent {
  @Input({ required: true }) title = '';
  @Input() backLink: string | any[] = '/ajustes';
  @Input() dockActions: MobileDockAction[] | null = null;
  @Input() dockSecondaryFixed = false;

  @Output() readonly dockAction = new EventEmitter<string>();

  get showDock(): boolean {
    return !!this.dockActions?.length;
  }

  onDockAction(id: string): void {
    this.dockAction.emit(id);
  }
}
