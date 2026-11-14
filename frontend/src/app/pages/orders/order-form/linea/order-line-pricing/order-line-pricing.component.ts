import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CurrencyArsPipe } from '../../../../../shared/pipes/labels.pipe';

@Component({
  selector: 'app-order-line-pricing',
  standalone: true,
  imports: [FormsModule, CurrencyArsPipe],
  templateUrl: './order-line-pricing.component.html',
  styleUrl: './order-line-pricing.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'order-line__pricing order-line__pricing--quote order-line__pricing--panel',
    '[class.order-line__pricing--design]': 'designLayout',
    '[class.order-line__pricing--wholesale]': 'showWholesaleColumns',
  },
})
export class OrderLinePricingComponent {
  @Input() designLayout = false;
  @Input() quoteVariant = false;
  @Input() quantity: number | string = 1;
  @Input() lineIndex = 0;
  @Input() usePlainCostPrefix = false;
  @Input() unitCostFormatted = '';
  @Input() unitCostHint = '';
  /** Servicio de un tercero / insumo: el costo se carga a mano. */
  @Input() unitCostEditable = false;
  @Input() unitCostValue: number | string = 0;
  @Input() unitPrice: number | string = 0;
  @Input() unitPriceError = '';
  @Input() priceHint = '';
  @Input() priceHintWarn = false;
  @Input() manualPrice = false;
  /** Precio tomado del catálogo: no se edita (línea de insumo). */
  @Input() priceLocked = false;
  @Input() lineTotal = 0;

  /** Vista previa mayorista: columnas Lista (tachada) + Mayorista. */
  @Input() showWholesaleColumns = false;
  @Input() listUnitPrice = 0;
  @Input() wholesaleUnitPrice = 0;
  @Input() wholesaleMarginHint = '';
  @Input() wholesaleMarginWarn = false;
  @Input() closedPriceNote = '';

  @Output() unitCostChange = new EventEmitter<number | string>();
  @Output() unitPriceChange = new EventEmitter<number | string>();
  @Output() unitPriceBlur = new EventEmitter<void>();
  @Output() resetPrice = new EventEmitter<void>();

  /** Miles con formato es-AR; el modelo emitido sigue siendo numérico. */
  get unitPriceDisplay(): string {
    if (this.unitPrice === '' || this.unitPrice == null) return '';
    const amount = Math.round(Number(this.unitPrice) || 0);
    return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(amount);
  }

  get unitCostDisplay(): string {
    if (this.unitCostValue === '' || this.unitCostValue == null) return '';
    const amount = Math.round(Number(this.unitCostValue) || 0);
    return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(amount);
  }

  onUnitCostDisplayChange(raw: string): void {
    const digits = String(raw ?? '').replace(/\D/g, '');
    this.unitCostChange.emit(digits ? Math.round(Number(digits)) : 0);
  }

  onUnitPriceDisplayChange(raw: string): void {
    const digits = String(raw ?? '').replace(/\D/g, '');
    if (!digits) {
      this.unitPriceChange.emit('');
      return;
    }
    this.unitPriceChange.emit(Math.round(Number(digits)));
  }
}
