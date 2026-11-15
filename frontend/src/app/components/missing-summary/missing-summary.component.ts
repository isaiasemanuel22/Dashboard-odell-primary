import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';

export interface MissingSummaryItem {
  /** Texto visible («cliente», «precio de la línea 1»). */
  label: string;
  /** Identificador que el formulario usa para llevar al campo. */
  key: string;
}

/**
 * Resumen en rojo «Falta: a · b» junto al botón de guardar. Cada ítem es un
 * botón que avisa al formulario para llevar la vista al campo y enfocarlo.
 */
@Component({
  selector: 'app-missing-summary',
  standalone: true,
  template: `
    @if (items().length) {
      <p class="missing-summary" role="status">
        @if (prefix()) {
          <span>{{ prefix() }}</span>
        } @else {
          <span>{{ items().length === 1 ? 'Falta:' : 'Faltan:' }}</span>
        }
        @for (item of items(); track item.key + item.label; let last = $last) {
          <button
            type="button"
            class="missing-summary__item"
            (click)="select.emit(item)"
          >{{ item.label }}</button>
          @if (!last) {
            <span aria-hidden="true">·</span>
          }
        }
        @if (suffix()) {
          <span class="missing-summary__suffix">{{ suffix() }}</span>
        }
      </p>
    }
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
      flex: 1 1 auto;
    }

    .missing-summary {
      margin: 0;
      color: #b91c1c;
      font-size: 13px;
      font-weight: 600;
      line-height: 1.45;
      text-align: left;
    }

    .missing-summary > * {
      margin-right: 0.3em;
    }

    .missing-summary__item {
      appearance: none;
      background: none;
      border: 0;
      padding: 0;
      font-family: inherit;
      font-size: inherit;
      font-weight: 700;
      line-height: inherit;
      color: inherit;
      text-decoration: underline;
      text-underline-offset: 2px;
      cursor: pointer;
    }

    .missing-summary__item:focus-visible {
      outline: 2px solid #b91c1c;
      outline-offset: 2px;
      border-radius: 2px;
    }

    .missing-summary__suffix {
      color: #7f1d1d;
      font-weight: 500;
    }

    @media (max-width: 768px) {
      :host {
        width: 100%;
      }

      .missing-summary {
        font-size: 13px;
        text-align: center;
      }

      .missing-summary__item {
        padding: 2px 0;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MissingSummaryComponent {
  readonly items = input<MissingSummaryItem[]>([]);
  readonly prefix = input('');
  readonly suffix = input('');
  readonly select = output<MissingSummaryItem>();
}
