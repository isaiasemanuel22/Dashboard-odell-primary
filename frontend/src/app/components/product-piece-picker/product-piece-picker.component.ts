import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  Output,
  ViewChild,
  inject,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Category, Product } from '../../core/models';
import { PRODUCT_TYPE_LABELS } from '../../shared/constants/labels';
import {
  isProductPublished,
  resolveProductUnitCost,
} from '../../shared/utils/product.helpers';
import { productPhysicalStock } from '../../shared/utils/stock.helpers';
import { FormDialogService } from '../../modals/public-api';
import { BreakpointService } from '../../core/services/breakpoint.service';
import { LayoutUiService } from '../../layout/layout-ui.service';
import { DbButtonComponent } from '../db-button/db-button.component';
import { MobileBarComponent } from '../mobile-bar/mobile-bar.component';
import { normalizeSearchText } from '../../shared/utils/search-text.util';

@Component({
  selector: 'app-product-piece-picker',
  standalone: true,
  imports: [FormsModule, NgTemplateOutlet, DbButtonComponent, MobileBarComponent],
  templateUrl: './product-piece-picker.component.html',
  styleUrl: './product-piece-picker.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductPiecePickerComponent implements OnDestroy {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly formDialogs = inject(FormDialogService);
  private readonly layoutUi = inject(LayoutUiService);
  private readonly breakpoint = inject(BreakpointService);
  private overlayPushed = false;

  readonly isMobile = this.breakpoint.isMobile;

  @Input({ required: true }) products: Product[] = [];
  @Input() categories: Category[] = [];
  @Input() excludeIds: string[] = [];
  @Input() disabled = false;
  @Input() loading = false;

  @Output() readonly pieceSelected = new EventEmitter<string>();
  @Output() readonly pieceCreated = new EventEmitter<Product>();

  @ViewChild('inputRef') inputRef?: ElementRef<HTMLInputElement>;
  @ViewChild('mobileInputRef') set mobileInputRef(ref: ElementRef<HTMLInputElement> | undefined) {
    if (ref) setTimeout(() => ref.nativeElement.focus());
  }

  query = '';
  isOpen = false;
  highlightedIndex = -1;

  get available(): Product[] {
    const excluded = new Set(this.excludeIds);
    return this.products.filter((product) => !excluded.has(product.id));
  }

  get filtered(): Product[] {
    const q = normalizeSearchText(this.query);
    if (!q) return this.available;
    return this.available.filter((product) =>
      normalizeSearchText(product.name).includes(q),
    );
  }

  thumb(product: Product): string | null {
    return product.images?.[0] || null;
  }

  meta(product: Product): string {
    const category = this.categoryLabel(product);
    // Costo vigente que devuelve el servidor; recalcular solo si no viene.
    const cost =
      Number(product.cost) > 0
        ? Number(product.cost)
        : resolveProductUnitCost(product, this.products);
    const stock = productPhysicalStock(product);
    const stockLabel = stock > 0 ? `${stock} en stock` : 'sin stock';
    return `${category} · costo ${this.formatMoney(cost)} · ${stockLabel}`;
  }

  badge(product: Product): { label: string; kind: 'published' | 'internal' } {
    return isProductPublished(product)
      ? { label: 'Publicado', kind: 'published' }
      : { label: 'Interno', kind: 'internal' };
  }

  onFocus(): void {
    if (this.disabled) return;
    this.open();
  }

  /** En mobile el campo es solo un disparador: abre la pantalla completa. */
  onFieldClick(): void {
    if (this.disabled || this.isOpen) return;
    this.open();
  }

  private open(): void {
    this.isOpen = true;
    this.highlightedIndex = this.filtered.length ? 0 : -1;
    if (this.isMobile() && !this.overlayPushed) {
      this.overlayPushed = true;
      this.layoutUi.pushOverlay();
    }
  }

  onQueryChange(value: string): void {
    this.query = value;
    this.open();
  }

  onKeydown(event: KeyboardEvent): void {
    if (!this.isOpen && (event.key === 'ArrowDown' || event.key === 'Enter')) {
      this.isOpen = true;
      event.preventDefault();
      return;
    }
    if (!this.isOpen) return;

    const count = this.filtered.length;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!count) return;
      this.highlightedIndex = (this.highlightedIndex + 1) % count;
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!count) return;
      this.highlightedIndex =
        this.highlightedIndex <= 0 ? count - 1 : this.highlightedIndex - 1;
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const item = this.filtered[this.highlightedIndex];
      if (item) this.select(item);
      return;
    }
    if (event.key === 'Escape') {
      // Cierra solo el desplegable: el modal no debe pedir «Descartar cambios».
      event.preventDefault();
      event.stopPropagation();
      this.close();
    }
  }

  select(product: Product): void {
    this.pieceSelected.emit(product.id);
    this.query = '';
    this.close();
  }

  createPiece(): void {
    this.close();
    this.formDialogs.openProduct().subscribe((saved) => {
      if (!saved) return;
      this.pieceCreated.emit(saved);
      this.pieceSelected.emit(saved.id);
    });
  }

  onOptionMouseDown(event: MouseEvent): void {
    event.preventDefault();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.isMobile()) return;
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }

  close(): void {
    this.isOpen = false;
    this.highlightedIndex = -1;
    this.releaseOverlay();
    if (this.isMobile()) this.inputRef?.nativeElement.blur();
  }

  ngOnDestroy(): void {
    this.releaseOverlay();
  }

  private releaseOverlay(): void {
    if (!this.overlayPushed) return;
    this.overlayPushed = false;
    this.layoutUi.popOverlay();
  }

  private categoryLabel(product: Product): string {
    const names = (product.categoryIds ?? [])
      .map((id) => this.categories.find((category) => category.id === id)?.name)
      .filter((name): name is string => Boolean(name));
    if (names.length) return names[0];
    if (!isProductPublished(product)) return 'Insumo interno';
    return PRODUCT_TYPE_LABELS[product.type] ?? product.type;
  }

  private formatMoney(value: number): string {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0,
    }).format(value);
  }
}
