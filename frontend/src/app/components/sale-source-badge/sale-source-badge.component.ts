import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { SaleSource } from '../../core/models';
import { SALE_SOURCE_LABELS } from '../../shared/constants/labels';

@Component({
  selector: 'app-sale-source-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sale-source-badge.component.html',
  styleUrl: './sale-source-badge.component.scss',
})
export class SaleSourceBadgeComponent {
  @Input({ required: true }) source!: SaleSource;

  get label(): string {
    return SALE_SOURCE_LABELS[this.source];
  }

  readonly SaleSource = SaleSource;
}
