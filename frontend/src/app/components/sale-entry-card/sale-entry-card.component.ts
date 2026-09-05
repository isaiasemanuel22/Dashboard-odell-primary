import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { SaleEntry, SaleSource } from '../../core/models';
import { DbButtonComponent } from '../db-button/db-button.component';
import { SaleEntryItemComponent } from '../sale-entry-item/sale-entry-item.component';
import { SaleSourceBadgeComponent } from '../sale-source-badge/sale-source-badge.component';
import { CurrencyArsPipe, DateShortPipe } from '../../shared/pipes/labels.pipe';

@Component({
  selector: 'app-sale-entry-card',
  standalone: true,
  imports: [
    RouterLink,
    DateShortPipe,
    CurrencyArsPipe,
    DbButtonComponent,
    SaleSourceBadgeComponent,
    SaleEntryItemComponent,
  ],
  templateUrl: './sale-entry-card.component.html',
  styleUrl: './sale-entry-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SaleEntryCardComponent {
  @Input({ required: true }) entry!: SaleEntry;
  @Output() edit = new EventEmitter<SaleEntry>();
  @Output() delete = new EventEmitter<SaleEntry>();

  readonly SaleSource = SaleSource;
}
