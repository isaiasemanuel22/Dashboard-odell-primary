import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  inject,
} from '@angular/core';
import { SaleEntry } from '../../core/models';
import { BreakpointService } from '../../core/services/breakpoint.service';
import { SaleEntryRowComponent } from '../sale-entry-row/sale-entry-row.component';
import { SaleEntryCardComponent } from '../sale-entry-card/sale-entry-card.component';

@Component({
  selector: 'app-sales-table',
  standalone: true,
  imports: [SaleEntryRowComponent, SaleEntryCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sales-table.component.html',
  styleUrl: './sales-table.component.scss',
})
export class SalesTableComponent {
  private readonly breakpoint = inject(BreakpointService);

  @Input({ required: true }) entries!: SaleEntry[];
  @Output() edit = new EventEmitter<SaleEntry>();
  @Output() delete = new EventEmitter<SaleEntry>();

  get isMobile(): boolean {
    return this.breakpoint.isMobile();
  }
}
