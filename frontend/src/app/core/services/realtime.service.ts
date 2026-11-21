import { DestroyRef, Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject, debounceTime, filter, firstValueFrom, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';
import {
  RealtimeEvent,
  RealtimeMessage,
  RealtimeScope,
  isRealtimeEvent,
} from '../models/realtime.model';
import {
  readRealtimeSyncEnabled,
  writeRealtimeSyncEnabled,
} from './realtime-sync.preference';

export interface SmartReloadOptions {
  skip?: () => boolean;
}

interface RealtimePollResponse {
  events: RealtimeEvent[];
  serverTime: string;
}

const POLL_INTERVAL_MS = 15_000;
/** Esperas entre reintentos del stream SSE; la última se repite. */
const STREAM_RETRY_DELAYS_MS = [1_000, 2_000, 5_000, 15_000];

/**
 * Separa los mensajes completos (terminan en línea vacía) de un texto SSE.
 * Devuelve el `data` de cada mensaje e ignora comentarios y mensajes sin datos.
 */
export function parseSseChunk(buffer: string): { data: string[]; rest: string } {
  const blocks = buffer.replace(/\r\n?/g, '\n').split('\n\n');
  const rest = blocks.pop() ?? '';
  const data: string[] = [];
  for (const block of blocks) {
    const lines = block
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).replace(/^ /, ''));
    if (lines.length) {
      data.push(lines.join('\n'));
    }
  }
  return { data, rest };
}

@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly eventSubject = new Subject<RealtimeEvent>();
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private streamRetryTimer: ReturnType<typeof setTimeout> | null = null;
  private streamAbort: AbortController | null = null;
  private streamOpen = false;
  private streamAttempt = 0;
  private polling = false;
  private lastPollAt = new Date(0).toISOString();
  private readonly onVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      if (!this.streamAbort) {
        this.clearStreamRetry();
        void this.openStream();
      }
      void this.poll();
    }
  };

  readonly events$ = this.eventSubject.asObservable();

  isSyncEnabled(): boolean {
    return readRealtimeSyncEnabled();
  }

  setSyncEnabled(enabled: boolean): void {
    writeRealtimeSyncEnabled(enabled);
    if (enabled) {
      this.connect();
      return;
    }
    this.disconnect();
  }

  connectIfEnabled(): void {
    if (this.isSyncEnabled()) {
      this.connect();
    }
  }

  connect(): void {
    if (!this.isSyncEnabled()) {
      return;
    }
    if (this.pollTimer) return;

    // Con el stream abierto los eventos llegan solos: no se pollea.
    this.pollTimer = setInterval(() => {
      if (!this.streamOpen && document.visibilityState === 'visible') {
        void this.poll();
      }
    }, POLL_INTERVAL_MS);

    document.addEventListener('visibilitychange', this.onVisibilityChange);
    void this.openStream();
  }

  disconnect(): void {
    this.clearReconnect();
    this.clearStreamRetry();
    this.streamAbort?.abort();
    this.streamAbort = null;
    this.streamOpen = false;
    this.streamAttempt = 0;
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
    if (!this.isSyncEnabled()) {
      return;
    }
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

  /**
   * Stream SSE con fetch: EventSource no manda el header Authorization.
   * Al abrir hace un poll para recuperar lo que pasó sin stream.
   */
  private async openStream(): Promise<void> {
    if (this.streamAbort || !this.isSyncEnabled()) return;
    const abort = new AbortController();
    this.streamAbort = abort;
    let opened = false;

    try {
      const token = this.auth.enabled ? await this.auth.getIdToken() : null;
      const response = await fetch(`${environment.apiUrl}/events/stream`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        cache: 'no-store',
        signal: abort.signal,
      });
      if (!response.ok || !response.body) return;

      opened = true;
      this.streamOpen = true;
      this.streamAttempt = 0;
      void this.poll();
      await this.readStream(response.body);
    } catch {
      // Sin red o cortado: se reintenta abajo.
    } finally {
      if (this.streamAbort === abort) {
        this.streamAbort = null;
        this.streamOpen = false;
        // Primer intento fallido: se pollea igual, como sin stream.
        if (!opened && this.streamAttempt === 0) void this.poll();
        this.scheduleStreamRetry();
      }
    }
  }

  private async readStream(body: ReadableStream<Uint8Array>): Promise<void> {
    const reader = body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return;
      const parsed = parseSseChunk(buffer + value);
      buffer = parsed.rest;
      for (const data of parsed.data) {
        this.receive(data);
      }
    }
  }

  private receive(data: string): void {
    let message: RealtimeMessage;
    try {
      message = JSON.parse(data) as RealtimeMessage;
    } catch {
      return;
    }
    if (!isRealtimeEvent(message)) return;
    this.lastPollAt = message.at;
    this.eventSubject.next(message);
  }

  private scheduleStreamRetry(): void {
    if (this.streamRetryTimer || !this.pollTimer) return;
    const delay =
      STREAM_RETRY_DELAYS_MS[
        Math.min(this.streamAttempt, STREAM_RETRY_DELAYS_MS.length - 1)
      ];
    this.streamAttempt++;
    this.streamRetryTimer = setTimeout(() => {
      this.streamRetryTimer = null;
      void this.openStream();
    }, delay);
  }

  private clearStreamRetry(): void {
    if (!this.streamRetryTimer) return;
    clearTimeout(this.streamRetryTimer);
    this.streamRetryTimer = null;
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
