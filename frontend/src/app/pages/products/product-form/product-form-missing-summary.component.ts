import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';

/**
 * Resumen rojo «Falta: a · b» con cada faltante como botón que lleva al campo.
 * Se usa en el pie (escritorio), en el dock y arriba del formulario (mobile).
 */
@Component({
  selector: 'app-product-form-missing-summary',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (items.length) {
      <p class="missing" role="status" [class.missing--banner]="banner">
        <span class="missing__lead">{{ items.length === 1 ? 'Falta:' : 'Faltan:' }}</span>
        @for (item of items; track item; let last = $last) {
          <button type="button" class="missing__item" (click)="select.emit(item)">
            {{ item }}
          </button>
          @if (!last) {
            <span class="missing__sep" aria-hidden="true">·</span>
          }
        }
      </p>
    }
  `,
  styles: [
    `
      :host {
        display: block;
        min-width: 0;
      }
      .missing {
        margin: 0;
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: 2px 6px;
        font-size: 13px;
        line-height: 1.4;
        font-weight: 600;
        color: #c0392b;
      }
      .missing--banner {
        padding: 10px 12px;
        border: 1px solid #f1b7b0;
        border-radius: 10px;
        background: #fdf0ee;
      }
      .missing__item {
        padding: 0;
        border: 0;
        background: none;
        font-family: inherit;
        font-size: inherit;
        font-weight: 700;
        color: inherit;
        text-decoration: underline;
        text-underline-offset: 2px;
        cursor: pointer;
      }
      @media (max-width: 768px) {
        .missing__item {
          min-height: 28px;
        }
      }
    `,
  ],
})
export class ProductFormMissingSummaryComponent {
  @Input() items: readonly string[] = [];
  @Input() banner = false;
  @Output() readonly select = new EventEmitter<string>();
}
