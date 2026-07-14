import { Component, Input } from '@angular/core';
import { ServiceType } from '../../core/models';
import { ServiceTypeLabelPipe } from '../../shared/pipes/labels.pipe';

export type DbServiceBadgeVariant = 'default' | 'solid';

@Component({
  selector: 'db-service-badge',
  standalone: true,
  imports: [ServiceTypeLabelPipe],
  template: `<span [class]="classes">{{ type | serviceTypeLabel }}</span>`,
  styleUrl: './db-service-badge.component.scss',
})
export class DbServiceBadgeComponent {
  @Input({ required: true }) type!: ServiceType;
  @Input() variant: DbServiceBadgeVariant = 'default';

  get classes(): string {
    return `db-service-badge db-service-badge--${this.variant}`;
  }
}
