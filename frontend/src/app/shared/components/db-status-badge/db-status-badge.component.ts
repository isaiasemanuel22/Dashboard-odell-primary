import { Component, Input } from '@angular/core';

@Component({
  selector: 'db-status-badge',
  standalone: true,
  template: `<span class="status" [class]="statusClass">{{ label }}</span>`,
})
export class DbStatusBadgeComponent {
  @Input({ required: true }) statusClass!: string;
  @Input({ required: true }) label!: string;
}
