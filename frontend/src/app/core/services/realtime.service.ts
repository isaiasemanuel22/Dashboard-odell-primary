import { DestroyRef, Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject, debounceTime, filter, firstValueFrom, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  RealtimeEvent,
  RealtimeScope,
} from '../models/realtime.model';

export interface SmartReloadOptions {
  skip?: () => boolean;
}

interface RealtimePollResponse {
  events: RealtimeEvent[];
  serverTime: string;
}

const POLL_INTERVAL_MS = 15_000;

@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private readonly http = inject(HttpClient);
  private readonly eventSubject = new Subject<RealtimeEvent>();
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private polling = false;
  private lastPollAt = new Date(0).toISOString();
  private readonly onVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      void this.poll();
    }
  };

  readonly events$ = this.eventSubject.asObservable();

  connect(): void {
    if (this.pollTimer) return;

    void this.poll();
    this.pollTimer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        void this.poll();
      }
    }, POLL_INTERVAL_MS);

    document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  disconnect(): void {
    this.clearReconnect();
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
  }

  watchEvents(
    scopes: RealtimeScope | RealtimeScope[],
  ): Observable<RealtimeEvent> {
    const scopeList = Array.isArray(scopes) ? scopes : [scopes];

    return this.events$.pipe(
      filter((event) => event.scope === 'all' || scopeList.includes(event.scope)),
      debounceTime(250),
    );
  }

  watchScopes(scopes: RealtimeScope | RealtimeScope[]): Observable<void> {
    return this.watchEvents(scopes).pipe(map(() => void 0));
  }

  bindReload(
    destroyRef: DestroyRef,
    scopes: RealtimeScope | RealtimeScope[],
    reload: () => void,
    options?: SmartReloadOptions,
  ): void {
    this.watchScopes(scopes)
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe(() => {
        if (options?.skip?.()) return;
        reload();
      });
  }

  bindSmartReload(
    destroyRef: DestroyRef,
    scopes: RealtimeScope | RealtimeScope[],
    handler: (event: RealtimeEvent) => void,
    options?: SmartReloadOptions,
  ): void {
    this.watchEvents(scopes)
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((event) => {
        if (options?.skip?.()) return;
        handler(event);
      });
  }

  private async poll(): Promise<void> {
    if (this.polling) return;
    this.polling = true;

    try {
      const response = await firstValueFrom(
        this.http.get<RealtimePollResponse>(`${environment.apiUrl}/events/poll`, {
          params: { since: this.lastPollAt },
        }),
      );

      this.lastPollAt = response.serverTime;
      for (const event of response.events) {
        this.eventSubject.next(event);
      }
      this.clearReconnect();
    } catch {
      this.scheduleReconnect();
    } finally {
      this.polling = false;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.poll();
    }, 5000);
  }

  private clearReconnect(): void {
    if (!this.reconnectTimer) return;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }
}
