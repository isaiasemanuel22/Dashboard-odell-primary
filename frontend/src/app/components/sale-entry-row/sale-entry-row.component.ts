import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SaleEntry, SaleSource } from '../../core/models';
import { CurrencyArsPipe, DateShortPipe } from '../../shared/pipes/labels.pipe';
import { DbButtonComponent } from '../db-button/db-button.component';
import { SaleEntryItemComponent } from '../sale-entry-item/sale-entry-item.component';
import { SaleSourceBadgeComponent } from '../sale-source-badge/sale-source-badge.component';

@Component({
  selector: 'app-sale-entry-row',
  standalone: true,
  imports: [
    RouterLink,
    CurrencyArsPipe,
    DateShortPipe,
    DbButtonComponent,
    SaleEntryItemComponent,
    SaleSourceBadgeComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sale-entry-row.component.html',
  styleUrl: './sale-entry-row.component.scss',
})
export class SaleEntryRowComponent {
  @Input({ required: true }) entry!: SaleEntry;
  @Output() edit = new EventEmitter<SaleEntry>();
  @Output() delete = new EventEmitter<SaleEntry>();

  readonly SaleSource = SaleSource;
}
