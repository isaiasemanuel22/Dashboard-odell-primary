import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnDestroy,
  OnInit,
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
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ControlValueAccessor,
  NG_VALUE_ACCESSOR,
} from '@angular/forms';
import { take } from 'rxjs';
import {
  ColorConfig,
  FilamentType,
  INDISTINTO_COLOR_ID,
  ResinType,
  Supply,
  SupplyCategory,
} from '../../../core/models';
import { SuppliesService } from '../../../core/services/settings.service';
import { SettingsFacade } from '../../../store/settings/settings.facade';
import {
  normalizeColorId,
  resolveColorHex,
  resolveColorLabel,
} from '../../../shared/utils/color.helpers';
import { DbFormFieldComponent } from '../db-form-field/db-form-field.component';
import { DbColorSelectOption } from './db-color-select.types';

let dbColorSelectId = 0;

@Component({
  selector: 'db-color-select',
  standalone: true,
  imports: [NgTemplateOutlet, DbFormFieldComponent],
  templateUrl: './db-color-select.component.html',
  styleUrl: './db-color-select.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DbColorSelectComponent),
      multi: true,
    },
  ],
})
export class DbColorSelectComponent
  implements OnInit, OnChanges, OnDestroy, ControlValueAccessor
{
  private readonly overlay = inject(Overlay);
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly settingsFacade = inject(SettingsFacade);
  private readonly suppliesService = inject(SuppliesService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private overlayRef: OverlayRef | null = null;

  @ViewChild('popover') private popoverTpl?: TemplateRef<unknown>;
  @Input() label = '';
  @Input() hint = '';
  @Input() error = '';
  @Input() required = false;
  @Input() disabled = false;
  @Input() appearance: 'panel' | 'popover' = 'panel';
  /** Filtra qué insumos marcan `inStock` (FDM). */
  @Input() filamentType?: FilamentType | null;
  /** Filtra qué insumos marcan `inStock` (resina). */
  @Input() resinType?: ResinType | string | null;
  /** Filtra insumos por categoría (p. ej. estampado). */
  @Input() supplyCategory?: SupplyCategory | null;
  /** Filtra insumos compatibles con un insumo elegido (estampado). */
  @Input() supplyId?: string | null;

  readonly groupId = `db-color-select-${++dbColorSelectId}`;
  value: string = '';
  panelOpen = false;
  query = '';

  private catalog: ColorConfig[] = [];
  private supplies: Supply[] = [];
  private builtOptions: DbColorSelectOption[] = [];
  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  ngOnInit(): void {
    this.settingsFacade
      .watchUntilDestroyed(this.destroyRef)
      .subscribe((settings) => {
        this.catalog = settings?.colors ?? [];
        this.rebuildCatalogOptions();
        this.cdr.markForCheck();
      });

    this.suppliesService
      .watchSupplies()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((items) => {
        this.supplies = items;
        this.rebuildCatalogOptions();
        this.cdr.markForCheck();
      });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['disabled'] && this.disabled) {
      this.closePanel();
      this.onTouched();
    }
    if (
      changes['filamentType'] ||
      changes['resinType'] ||
      changes['supplyCategory'] ||
      changes['supplyId']
    ) {
      this.rebuildCatalogOptions();
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

  get resolvedOptions(): DbColorSelectOption[] {
    return this.ensureCurrentColor(this.builtOptions);
  }

  selectedOption(): DbColorSelectOption {
    const value = this.value?.trim() || INDISTINTO_COLOR_ID;
    const found = this.resolvedOptions.find((option) => option.value === value);
    if (found) return found;
    if (value === INDISTINTO_COLOR_ID) {
      return {
        value: INDISTINTO_COLOR_ID,
        label: 'Indistinto',
        hint: 'el que haya en stock',
      };
    }
    return {
      value,
      label: resolveColorLabel(value, this.catalog),
      hex: resolveColorHex(value, this.catalog),
    };
  }

  isSelected(value: string): boolean {
    return this.value === value;
  }

  get filteredOptions(): DbColorSelectOption[] {
    const term = this.query.trim().toLowerCase();
    if (!term) return this.resolvedOptions;
    return this.resolvedOptions.filter((option) =>
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
    this.cdr.markForCheck();
  }

  writeValue(value: unknown): void {
    if (typeof value === 'string' && value.trim()) {
      this.value = value.trim();
      this.cdr.markForCheck();
      return;
    }
    this.value = INDISTINTO_COLOR_ID;
    this.cdr.markForCheck();
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
    this.cdr.markForCheck();
  }

  private rebuildCatalogOptions(): void {
    const stockIds = this.resolveStockColorIds();
    const options: DbColorSelectOption[] = [
      {
        value: INDISTINTO_COLOR_ID,
        label: 'Indistinto',
        hint: 'el que haya en stock',
      },
    ];
    for (const color of this.catalog) {
      options.push({
        value: color.id,
        label: color.name,
        hex: color.hex,
        inStock: stockIds.has(color.id),
      });
    }
    this.builtOptions = options;
  }

  private resolveStockColorIds(): Set<string> {
    let compatible = this.supplies;
    if (this.filamentType) {
      compatible = compatible.filter(
        (supply) =>
          supply.category === SupplyCategory.FDM &&
          supply.filamentType === this.filamentType,
      );
    } else if (this.resinType) {
      compatible = compatible.filter(
        (supply) =>
          supply.category === SupplyCategory.RESINA &&
          supply.resinType === this.resinType,
      );
    } else if (this.supplyId) {
      const selected = this.supplies.find(
        (supply) => supply.id === this.supplyId,
      );
      compatible = selected
        ? this.supplies.filter(
            (supply) =>
              supply.category === selected.category &&
              (!selected.filamentType ||
                supply.filamentType === selected.filamentType) &&
              (!selected.resinType || supply.resinType === selected.resinType),
          )
        : [];
    } else if (this.supplyCategory) {
      compatible = compatible.filter(
        (supply) => supply.category === this.supplyCategory,
      );
    }
    return new Set(
      compatible
        .map((supply) => supply.colorId)
        .filter((colorId): colorId is string => !!colorId),
    );
  }

  private ensureCurrentColor(
    options: DbColorSelectOption[],
  ): DbColorSelectOption[] {
    const currentId = normalizeColorId(this.value);
    if (
      currentId === INDISTINTO_COLOR_ID ||
      options.some((option) => option.value === currentId)
    ) {
      return options;
    }
    return [
      ...options,
      {
        value: currentId,
        label: resolveColorLabel(currentId, this.catalog),
        hex: resolveColorHex(currentId, this.catalog),
      },
    ];
  }
}
