import { Injectable } from '@nestjs/common';
import {
  RealtimeAction,
  RealtimeEntity,
  RealtimeEvent,
  RealtimeScope,
} from './realtime.types';

export interface RealtimeNotifyOptions {
  action?: RealtimeAction;
  entity?: RealtimeEntity;
  id?: string;
}

const MAX_BUFFERED_EVENTS = 250;

@Injectable()
export class RealtimeService {
  private readonly recentEvents: RealtimeEvent[] = [];

  notify(
    scopes: RealtimeScope | RealtimeScope[],
    options?: RealtimeNotifyOptions,
  ): void {
    const scopeList = Array.isArray(scopes) ? scopes : [scopes];
    const unique = scopeList.length ? [...new Set(scopeList)] : (['all'] as RealtimeScope[]);
    const at = new Date().toISOString();
    for (const scope of unique) {
      this.pushEvent({
        scope,
        at,
        action: options?.action,
        entity: options?.entity,
        id: options?.id,
      });
    }
  }

  getEventsSince(since?: string): RealtimeEvent[] {
    if (!since?.trim()) {
      return [...this.recentEvents];
    }

    const sinceMs = Date.parse(since);
    if (Number.isNaN(sinceMs)) {
      return [...this.recentEvents];
    }

    return this.recentEvents.filter((event) => Date.parse(event.at) > sinceMs);
  }

  private pushEvent(event: RealtimeEvent): void {
    this.recentEvents.push(event);
    if (this.recentEvents.length > MAX_BUFFERED_EVENTS) {
      this.recentEvents.splice(0, this.recentEvents.length - MAX_BUFFERED_EVENTS);
    }
  }
}
