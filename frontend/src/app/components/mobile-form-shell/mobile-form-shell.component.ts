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

@Component({
  selector: 'db-mobile-form-shell',
  standalone: true,
  imports: [MobileDockComponent],
  templateUrl: './mobile-form-shell.component.html',
  styleUrl: './mobile-form-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileFormShellComponent {
  @Input() title = '';
  /** Si es false, solo cuerpo (+ dock); útil dentro de un modal que ya tiene título. */
  @Input() showHeader = true;
  /** Acción de texto a la derecha (ej. «Guardar borrador»). */
  @Input() headerActionLabel: string | null = null;
  @Input() headerActionDisabled = false;
  @Input() closeAriaLabel = 'Cerrar sin guardar';
  /** Si hay acciones, renderiza `db-mobile-dock` al pie. */
  @Input() dockActions: MobileDockAction[] | null = null;
  @Input() dockSecondaryFixed = false;

  @Output() readonly close = new EventEmitter<void>();
  @Output() readonly headerAction = new EventEmitter<void>();
  @Output() readonly dockAction = new EventEmitter<string>();

  get showDock(): boolean {
    return !!this.dockActions?.length;
  }

  onClose(): void {
    this.close.emit();
  }

  onHeaderAction(): void {
    if (this.headerActionDisabled) return;
    this.headerAction.emit();
  }

  onDockAction(id: string): void {
    this.dockAction.emit(id);
  }
}
