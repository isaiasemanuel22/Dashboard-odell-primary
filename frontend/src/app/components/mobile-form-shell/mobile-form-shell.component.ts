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
import { LayoutUiService } from '../../layout/layout-ui.service';
import { FormDialogService } from '../../modals/form-dialog.service';
import {
  MobileDockAction,
  MobileDockComponent,
} from '../mobile-dock/mobile-dock.component';
import { confirmMobileFormDiscard } from './confirm-mobile-form-discard';

@Component({
  selector: 'db-mobile-form-shell',
  standalone: true,
  imports: [MobileDockComponent],
  templateUrl: './mobile-form-shell.component.html',
  styleUrl: './mobile-form-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileFormShellComponent implements OnInit, OnDestroy {
  private readonly layoutUi = inject(LayoutUiService);
  private readonly formDialogs = inject(FormDialogService);
  private pageBarRegistered = false;
  private confirmingDiscard = false;

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
  /**
   * Si hay label, la X confirma descarte cuando `isDirty` (misma lógica que
   * pedido/presupuesto/cliente).
   */
  @Input() discardEntityLabel: string | null = null;
  @Input() isDirty = false;

  @Output() readonly close = new EventEmitter<void>();
  @Output() readonly headerAction = new EventEmitter<void>();
  @Output() readonly dockAction = new EventEmitter<string>();

  ngOnInit(): void {
    if (this.showHeader) {
      this.layoutUi.registerPageBar();
      this.pageBarRegistered = true;
    }
  }

  ngOnDestroy(): void {
    if (this.pageBarRegistered) {
      this.layoutUi.unregisterPageBar();
    }
  }

  get showDock(): boolean {
    return !!this.dockActions?.length;
  }

  /** Cierre con confirmación unificada (también usable desde el dialog padre). */
  requestClose(): void {
    this.onClose();
  }

  onClose(): void {
    if (this.confirmingDiscard) return;

    if (!this.discardEntityLabel) {
      this.close.emit();
      return;
    }

    this.confirmingDiscard = true;
    confirmMobileFormDiscard(this.formDialogs, {
      hasChanges: this.isDirty,
      entityLabel: this.discardEntityLabel,
    }).subscribe((confirmed) => {
      this.confirmingDiscard = false;
      if (confirmed) this.close.emit();
    });
  }

  onHeaderAction(): void {
    if (this.headerActionDisabled) return;
    this.headerAction.emit();
  }

  onDockAction(id: string): void {
    this.dockAction.emit(id);
  }
}
