import { DestroyRef, Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, Subject, debounceTime, filter, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';
import {
  RealtimeEvent,
  RealtimeMessage,
  RealtimeScope,
  isRealtimeEvent,
} from '../models/realtime.model';

export interface SmartReloadOptions {
  skip?: () => boolean;
}

@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private readonly auth = inject(AuthService);
  private readonly eventSubject = new Subject<RealtimeEvent>();
  private eventSource: EventSource | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connecting = false;

  readonly events$ = this.eventSubject.asObservable();

  async connect(): Promise<void> {
    if (this.eventSource || this.connecting) return;
    this.connecting = true;

    try {
      let url = `${environment.apiUrl}/events/stream`;
      const token = await this.auth.getIdToken();
      if (token) {
        url += `?token=${encodeURIComponent(token)}`;
      }

      this.eventSource = new EventSource(url);

      this.eventSource.onopen = () => {
        this.connecting = false;
      };

      this.eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string) as RealtimeMessage;
          if (isRealtimeEvent(data)) {
            this.eventSubject.next(data);
          }
        } catch {
          // Ignorar mensajes mal formados.
        }
      };

      this.eventSource.onerror = () => {
        this.connecting = false;
        this.close();
        this.scheduleReconnect();
      };
    } catch {
      this.connecting = false;
      this.scheduleReconnect();
    }
  }

  disconnect(): void {
    this.clearReconnect();
    this.close();
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

  /** Emite cuando llega un cambio relevante para los scopes indicados. */
  watchScopes(scopes: RealtimeScope | RealtimeScope[]): Observable<void> {
    return this.watchEvents(scopes).pipe(map(() => void 0));
  }

  /** Suscripción con limpieza automática al destruir el componente. */
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

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, 5000);
  }

  private clearReconnect(): void {
    if (!this.reconnectTimer) return;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private close(): void {
    this.eventSource?.close();
    this.eventSource = null;
  }
}
