import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  OnDestroy,
  TemplateRef,
  ViewChild,
  ViewContainerRef,
  forwardRef,
  HostListener,
  Input,
  OnChanges,
  SimpleChanges,
  inject,
} from '@angular/core';
import {
  ControlValueAccessor,
  NG_VALUE_ACCESSOR,
} from '@angular/forms';
import { take } from 'rxjs';
import { INDISTINTO_COLOR_ID } from '../../../core/models';
import { DbFormFieldComponent } from '../db-form-field/db-form-field.component';
import { DbColorSelectOption } from './db-color-select.types';

let dbColorSelectId = 0;

@Component({
  selector: 'db-color-select',
  standalone: true,
  imports: [NgTemplateOutlet, DbFormFieldComponent],
  templateUrl: './db-color-select.component.html',
  styleUrl: './db-color-select.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DbColorSelectComponent),
      multi: true,
    },
  ],
})
export class DbColorSelectComponent
  implements ControlValueAccessor, OnChanges, OnDestroy
{
  private readonly overlay = inject(Overlay);
  private readonly viewContainerRef = inject(ViewContainerRef);
  private overlayRef: OverlayRef | null = null;

  @ViewChild('popover') private popoverTpl?: TemplateRef<unknown>;
  @Input() label = '';
  @Input() hint = '';
  @Input() error = '';
  @Input() required = false;
  @Input() disabled = false;
  @Input() options: DbColorSelectOption[] = [];
  @Input() appearance: 'panel' | 'popover' = 'panel';

  readonly groupId = `db-color-select-${++dbColorSelectId}`;
  value: string = '';
  panelOpen = false;
  query = '';

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['disabled'] && this.disabled) {
      this.closePanel();
      this.onTouched();
    }
  }

  ngOnDestroy(): void {
    this.disposeOverlay();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.panelOpen) {
      this.closePanel();
    }
  }

  selectedOption(): DbColorSelectOption | undefined {
    return this.options.find((option) => option.value === this.value);
  }

  isSelected(value: string): boolean {
    return this.value === value;
  }

  get filteredOptions(): DbColorSelectOption[] {
    const term = this.query.trim().toLowerCase();
    if (!term) return this.options;
    return this.options.filter((option) =>
      [option.label, option.hint ?? '', option.hex ?? '']
        .join(' ')
        .toLowerCase()
        .includes(term),
    );
  }

  get indistintoOption(): DbColorSelectOption | undefined {
    return this.filteredOptions.find((option) => !option.hex && !option.inStock);
  }

  get stockOptions(): DbColorSelectOption[] {
    return this.filteredOptions.filter((option) => option.inStock && option.hex);
  }

  get catalogOptions(): DbColorSelectOption[] {
    return this.filteredOptions.filter((option) => !!option.hex);
  }

  openPanel(origin: EventTarget | null): void {
    if (this.disabled || this.panelOpen) {
      return;
    }

    this.query = '';
    this.panelOpen = true;
    this.onTouched();

    if (this.appearance !== 'popover' || !(origin instanceof HTMLElement) || !this.popoverTpl) {
      return;
    }

    const template = this.popoverTpl;
    queueMicrotask(() => {
      if (!this.panelOpen || this.overlayRef) return;
      this.overlayRef = this.overlay.create({
        positionStrategy: this.overlay
          .position()
          .flexibleConnectedTo(origin)
          .withFlexibleDimensions(false)
          .withPush(true)
          .withViewportMargin(8)
          .withPositions([
            {
              originX: 'start',
              originY: 'bottom',
              overlayX: 'start',
              overlayY: 'top',
              offsetY: 6,
            },
            {
              originX: 'start',
              originY: 'top',
              overlayX: 'start',
              overlayY: 'bottom',
              offsetY: -6,
            },
          ]),
        scrollStrategy: this.overlay.scrollStrategies.reposition(),
        hasBackdrop: true,
        backdropClass: 'db-color-select-backdrop',
        panelClass: 'db-color-select-panel',
      });
      this.overlayRef.attach(new TemplatePortal(template, this.viewContainerRef));
      this.overlayRef
        .backdropClick()
        .pipe(take(1))
        .subscribe(() => this.closePanel());
    });
  }

  closePanel(): void {
    this.panelOpen = false;
    this.disposeOverlay();
  }

  private disposeOverlay(): void {
    const ref = this.overlayRef;
    this.overlayRef = null;
    ref?.dispose();
  }

  pick(value: string): void {
    if (this.disabled) {
      return;
    }

    this.value = value;
    this.onChange(value);
    this.onTouched();
    this.closePanel();
  }

  writeValue(value: unknown): void {
    if (typeof value === 'string' && value.trim()) {
      this.value = value.trim();
      return;
    }
    // Vacío / null → Indistinto (presupuesto, pedido y producto).
    this.value = INDISTINTO_COLOR_ID;
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
    if (isDisabled) {
      this.closePanel();
    }
  }
}
