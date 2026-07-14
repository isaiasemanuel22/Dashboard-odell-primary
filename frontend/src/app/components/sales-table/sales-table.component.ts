import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { SaleEntry } from '../../core/models';
import { SaleEntryRowComponent } from '../sale-entry-row/sale-entry-row.component';

@Component({
  selector: 'app-sales-table',
  standalone: true,
  imports: [SaleEntryRowComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sales-table.component.html',
})
export class SalesTableComponent {
  @Input({ required: true }) entries!: SaleEntry[];
  @Output() edit = new EventEmitter<SaleEntry>();
  @Output() delete = new EventEmitter<SaleEntry>();
}
