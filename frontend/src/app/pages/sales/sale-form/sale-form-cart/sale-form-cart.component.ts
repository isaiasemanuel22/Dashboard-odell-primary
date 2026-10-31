import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SaleCartLine, SaleCartLineCardComponent, SaleCartLineComponent } from '@general-components';
import { CurrencyArsPipe } from '../../../../shared/pipes/labels.pipe';

@Component({
  selector: 'app-sale-form-cart',
  standalone: true,
  imports: [RouterLink, SaleCartLineComponent, SaleCartLineCardComponent, CurrencyArsPipe],
  templateUrl: './sale-form-cart.component.html',
  styleUrl: './sale-form-cart.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
})
export class SaleFormCartComponent {
  @Input() cart: SaleCartLine[] = [];
  @Input() useCardLayout = false;
  @Input() subtotal = 0;
  @Input() discount = 0;
  @Input() total = 0;
  @Input() profit = 0;
  @Input() hasDiscount = false;

  @Output() quantityChange = new EventEmitter<{ line: SaleCartLine; quantity: number }>();
  @Output() remove = new EventEmitter<string>();
}
