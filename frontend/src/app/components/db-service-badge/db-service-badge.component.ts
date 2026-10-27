import { Component, Input } from '@angular/core';
import { ServiceType } from '../../core/models';
import { ServiceTypeLabelPipe } from '../../shared/pipes/labels.pipe';
import { DbAreaChipComponent } from '../db-area-chip/db-area-chip.component';

export type DbServiceBadgeVariant = 'default' | 'solid';

@Component({
  selector: 'db-service-badge',
  standalone: true,
  imports: [ServiceTypeLabelPipe, DbAreaChipComponent],
  template: `
    <db-area-chip
      [area]="type"
      [label]="type | serviceTypeLabel"
      [tone]="variant === 'solid' ? 'outline' : 'soft'"
    />
  `,
  styles: `:host { display: inline-flex; }`,
})
export class DbServiceBadgeComponent {
  @Input({ required: true }) type!: ServiceType;
  @Input() variant: DbServiceBadgeVariant = 'default';
}
