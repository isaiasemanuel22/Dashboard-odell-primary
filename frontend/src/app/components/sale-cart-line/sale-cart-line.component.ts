import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CurrencyArsPipe } from '../../shared/pipes/labels.pipe';
import { DbButtonComponent } from '../db-button/db-button.component';

export interface SaleCartLine {
  key: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
}

@Component({
  selector: 'app-sale-cart-line',
  standalone: true,
  imports: [FormsModule, RouterLink, CurrencyArsPipe, DbButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sale-cart-line.component.html',
  styleUrl: './sale-cart-line.component.scss',
})
export class SaleCartLineComponent {
  @Input({ required: true }) line!: SaleCartLine;
  @Output() quantityChange = new EventEmitter<number>();
  @Output() remove = new EventEmitter<void>();

  get lineTotal(): number {
    return this.line.quantity * this.line.unitPrice;
  }

  onQuantityChange(value: number): void {
    const quantity = Number(value);
    if (!quantity || quantity <= 0) return;
    this.quantityChange.emit(quantity);
  }
}
