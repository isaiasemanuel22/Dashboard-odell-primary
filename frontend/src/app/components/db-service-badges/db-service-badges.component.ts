import { Component, Input } from '@angular/core';
import { ServiceType } from '../../core/models';
import { DbServiceBadgeComponent, DbServiceBadgeVariant } from '../db-service-badge/db-service-badge.component';

@Component({
  selector: 'db-service-badges',
  standalone: true,
  imports: [DbServiceBadgeComponent],
  template: `
    <div class="service-badges">
      @for (type of types; track type) {
        <db-service-badge [type]="type" [variant]="variant" />
      }
    </div>
  `,
  styles: `
    .service-badges {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
    }
  `,
})
export class DbServiceBadgesComponent {
  @Input({ required: true }) types!: ServiceType[];
  @Input() variant: DbServiceBadgeVariant = 'default';
}
