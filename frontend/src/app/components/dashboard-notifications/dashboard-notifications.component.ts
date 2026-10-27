import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  Input,
  inject,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  DashboardNotification,
  DashboardNotificationKind,
} from '../../core/models';
import { DbPillGroupComponent } from '../db-pill-group/db-pill-group.component';
import { DbServiceBadgeComponent } from '../db-service-badge/db-service-badge.component';

type NotificationFilter = 'all' | 'order' | 'stock' | 'queue' | 'calendar';

@Component({
  selector: 'app-dashboard-notifications',
  standalone: true,
  imports: [NgTemplateOutlet, RouterLink, DbPillGroupComponent, DbServiceBadgeComponent],
  templateUrl: './dashboard-notifications.component.html',
  styleUrl: './dashboard-notifications.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardNotificationsComponent {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly readIds = new Set<string>();

  @Input({ required: true }) notifications: DashboardNotification[] = [];

  open = false;
  filter: NotificationFilter = 'all';

  private readonly filterDefs: { value: NotificationFilter; label: string }[] = [
    { value: 'all', label: 'Todas' },
    { value: 'order', label: 'Pedidos' },
    { value: 'stock', label: 'Stock' },
    { value: 'queue', label: 'Cola' },
    { value: 'calendar', label: 'Agenda' },
  ];

  get filterOptions(): { value: NotificationFilter; label: string }[] {
    return this.filterDefs.map((item) => ({
      value: item.value,
      label: `${item.label} · ${this.countFor(item.value)}`,
    }));
  }

  get unreadCount(): number {
    return this.notifications.filter((item) => !this.readIds.has(item.id)).length;
  }

  get visibleNotifications(): DashboardNotification[] {
    if (this.filter === 'all') return this.notifications;
    return this.notifications.filter((item) => item.kind === this.filter);
  }

  countFor(filter: NotificationFilter): number {
    if (filter === 'all') return this.notifications.length;
    return this.notifications.filter((item) => item.kind === filter).length;
  }

  isRead(item: DashboardNotification): boolean {
    return this.readIds.has(item.id);
  }

  togglePanel(): void {
    this.open = !this.open;
  }

  closePanel(): void {
    this.open = false;
  }

  setFilter(filter: NotificationFilter): void {
    this.filter = filter;
  }

  markAllRead(): void {
    for (const item of this.notifications) {
      this.readIds.add(item.id);
    }
  }

  kindOf(item: DashboardNotification): DashboardNotificationKind {
    return item.kind;
  }

  trackNotification(_index: number, item: DashboardNotification): string {
    return item.id;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.open) return;
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.open = false;
    }
  }
}
