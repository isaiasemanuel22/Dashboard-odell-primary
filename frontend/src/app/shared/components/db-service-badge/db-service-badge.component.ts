import { Component, Input } from '@angular/core';
import { ServiceType } from '../../../core/models';
import { ServiceTypeLabelPipe } from '../../pipes/labels.pipe';

@Component({
  selector: 'db-service-badge',
  standalone: true,
  imports: [ServiceTypeLabelPipe],
  template: `<span class="badge">{{ type | serviceTypeLabel }}</span>`,
})
export class DbServiceBadgeComponent {
  @Input({ required: true }) type!: ServiceType;
}
