import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SaleEntryItem } from '../../core/models';
import { CurrencyArsPipe } from '../../shared/pipes/labels.pipe';

@Component({
  selector: 'app-sale-entry-item',
  standalone: true,
  imports: [RouterLink, CurrencyArsPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sale-entry-item.component.html',
  styleUrl: './sale-entry-item.component.scss',
})
export class SaleEntryItemComponent {
  @Input({ required: true }) item!: SaleEntryItem;
}
