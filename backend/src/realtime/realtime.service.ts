import { Injectable } from '@nestjs/common';
import { MessageEvent } from '@nestjs/common';
import { Observable, Subject, interval, map, merge } from 'rxjs';
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

@Injectable()
export class RealtimeService {
  private readonly events$ = new Subject<RealtimeEvent>();

  notify(
    scopes: RealtimeScope | RealtimeScope[],
    options?: RealtimeNotifyOptions,
  ): void {
    const scopeList = Array.isArray(scopes) ? scopes : [scopes];
    const unique = scopeList.length ? [...new Set(scopeList)] : (['all'] as RealtimeScope[]);
    const at = new Date().toISOString();
    for (const scope of unique) {
      this.events$.next({
        scope,
        at,
        action: options?.action,
        entity: options?.entity,
        id: options?.id,
      });
    }
  }

  stream(): Observable<MessageEvent> {
    const heartbeat = interval(30_000).pipe(
      map(
        () =>
          ({
            data: { type: 'ping', at: new Date().toISOString() },
          }) as MessageEvent,
      ),
    );

    const changes = this.events$.pipe(
      map((event) => ({ data: event }) as MessageEvent),
    );

    return merge(changes, heartbeat);
  }
}
