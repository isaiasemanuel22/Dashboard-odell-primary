import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
  inject,
} from '@angular/core';
import {
  MobileDockAction,
  MobileDockComponent,
} from '../mobile-dock/mobile-dock.component';
import { LayoutUiService } from '../../layout/layout-ui.service';

@Component({
  selector: 'db-mobile-sheet',
  standalone: true,
  imports: [MobileDockComponent],
  templateUrl: './mobile-sheet.component.html',
  styleUrl: './mobile-sheet.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileSheetComponent implements OnChanges, OnDestroy {
  private readonly layoutUi = inject(LayoutUiService);

  @Input() open = false;
  @Input() title = '';
  @Input() subtitle?: string;
  @Input() primaryLabel?: string;
  @Input() primaryDisabled = false;
  @Input() secondaryLabel?: string;
  /** aria-label del diálogo cuando no hay título visible. */
  @Input() ariaLabel?: string;

  @Output() readonly closed = new EventEmitter<void>();
  @Output() readonly primary = new EventEmitter<void>();
  @Output() readonly secondary = new EventEmitter<void>();

  @ViewChild('sheetPanel') private readonly sheetPanel?: ElementRef<HTMLElement>;
  @ViewChild('closeBtn') private readonly closeBtn?: ElementRef<HTMLButtonElement>;

  private overlayPushed = false;
  private previousFocus: HTMLElement | null = null;
  private escapeHandler: ((event: KeyboardEvent) => void) | null = null;

  get showHead(): boolean {
    return !!this.title || !!this.subtitle;
  }

  get showFoot(): boolean {
    return !!this.primaryLabel || !!this.secondaryLabel;
  }

  get dockActions(): MobileDockAction[] {
    const actions: MobileDockAction[] = [];
    if (this.secondaryLabel) {
      actions.push({
        id: 'secondary',
        label: this.secondaryLabel,
        kind: 'secondary',
      });
    }
    if (this.primaryLabel) {
      actions.push({
        id: 'primary',
        label: this.primaryLabel,
        kind: 'primary',
        disabled: this.primaryDisabled,
      });
    }
    return actions;
  }

  get dialogLabel(): string | null {
    if (this.title) return null;
    return this.ariaLabel || 'Hoja';
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']) {
      this.syncOpenState(this.open);
    }
  }

  ngOnDestroy(): void {
    this.teardownOpenState();
  }

  onScrimClick(): void {
    this.requestClose();
  }

  onCloseClick(): void {
    this.requestClose();
  }

  onDockAction(id: string): void {
    if (id === 'primary') {
      this.primary.emit();
      return;
    }
    if (id === 'secondary') {
      this.secondary.emit();
    }
  }

  private requestClose(): void {
    this.closed.emit();
  }

  private syncOpenState(open: boolean): void {
    if (open) {
      this.setupOpenState();
    } else {
      this.teardownOpenState();
    }
  }

  private setupOpenState(): void {
    if (!this.overlayPushed) {
      this.layoutUi.pushOverlay();
      this.overlayPushed = true;
    }
    if (!this.previousFocus) {
      const active = document.activeElement;
      this.previousFocus =
        active instanceof HTMLElement ? active : null;
    }
    if (!this.escapeHandler) {
      this.escapeHandler = (event: KeyboardEvent) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        this.requestClose();
      };
      document.addEventListener('keydown', this.escapeHandler);
    }
    queueMicrotask(() => {
      const target =
        this.closeBtn?.nativeElement ?? this.sheetPanel?.nativeElement;
      target?.focus();
    });
  }

  private teardownOpenState(): void {
    if (this.escapeHandler) {
      document.removeEventListener('keydown', this.escapeHandler);
      this.escapeHandler = null;
    }
    if (this.overlayPushed) {
      this.layoutUi.popOverlay();
      this.overlayPushed = false;
    }
    const restore = this.previousFocus;
    this.previousFocus = null;
    if (restore && typeof restore.focus === 'function') {
      queueMicrotask(() => restore.focus());
    }
  }
}
