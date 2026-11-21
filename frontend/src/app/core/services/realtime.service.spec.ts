import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';
import { RealtimeEvent } from '../models/realtime.model';
import { RealtimeService, parseSseChunk } from './realtime.service';
import { readRealtimeSyncEnabled } from './realtime-sync.preference';

const STORAGE_KEY = 'dashboard.realtimeSyncEnabled';
const pollUrl = `${environment.apiUrl}/events/poll`;

/**
 * Deja correr fetch y la lectura del stream. Usa MessageChannel porque
 * jasmine.clock() reemplaza setTimeout.
 */
async function flush(): Promise<void> {
  for (let i = 0; i < 5; i++) {
    await new Promise<void>((resolve) => {
      const channel = new MessageChannel();
      channel.port1.onmessage = () => resolve();
      channel.port2.postMessage(null);
    });
  }
}

function sseStream(): {
  response: Response;
  send: (text: string) => void;
  close: () => void;
} {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({
    start: (c) => (controller = c),
  });
  const encoder = new TextEncoder();
  return {
    response: new Response(body, { status: 200 }),
    send: (text) => controller.enqueue(encoder.encode(text)),
    close: () => controller.close(),
  };
}

describe('parseSseChunk', () => {
  it('devuelve el data de cada mensaje completo y guarda el resto', () => {
    const result = parseSseChunk('id: 1\ndata: {"a":1}\n\ndata: {"b"');
    expect(result.data).toEqual(['{"a":1}']);
    expect(result.rest).toBe('data: {"b"');
  });

  it('ignora comentarios y mensajes sin data, y acepta CRLF', () => {
    const result = parseSseChunk(
      ': ping\n\nevent: heartbeat\nid: 2\n\r\ndata: x\r\n\r\n',
    );
    expect(result.data).toEqual(['x']);
    expect(result.rest).toBe('');
  });

  it('une varias líneas data con salto de línea', () => {
    expect(parseSseChunk('data: uno\ndata:dos\n\n').data).toEqual([
      'uno\ndos',
    ]);
  });
});

describe('readRealtimeSyncEnabled', () => {
  afterEach(() => localStorage.removeItem(STORAGE_KEY));

  it('viene activada por defecto', () => {
    localStorage.removeItem(STORAGE_KEY);
    expect(readRealtimeSyncEnabled()).toBeTrue();
  });

  it('solo se apaga si el dispositivo guardó false', () => {
    localStorage.setItem(STORAGE_KEY, 'false');
    expect(readRealtimeSyncEnabled()).toBeFalse();
    localStorage.setItem(STORAGE_KEY, 'true');
    expect(readRealtimeSyncEnabled()).toBeTrue();
  });
});

describe('RealtimeService stream', () => {
  let service: RealtimeService;
  let http: HttpTestingController;
  let fetchSpy: jasmine.Spy;

  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY);
    jasmine.clock().install();
    spyOnProperty(document, 'visibilityState').and.returnValue('visible');
    fetchSpy = spyOn(window, 'fetch');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { enabled: false } },
      ],
    });
    service = TestBed.inject(RealtimeService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    service.disconnect();
    jasmine.clock().uninstall();
    http.verify();
  });

  it('pasa los eventos del stream y no pollea mientras está abierto', async () => {
    const stream = sseStream();
    fetchSpy.and.resolveTo(stream.response);
    const received: RealtimeEvent[] = [];
    service.events$.subscribe((event) => received.push(event));

    service.connect();
    await flush();
    expect(fetchSpy).toHaveBeenCalledOnceWith(
      `${environment.apiUrl}/events/stream`,
      jasmine.objectContaining({ cache: 'no-store' }),
    );
    // Poll de recuperación al abrir el stream.
    http.expectOne((r) => r.url === pollUrl).flush({
      events: [],
      serverTime: '2026-11-21T10:00:00.000Z',
    });
    await flush();

    stream.send('data: {"type":"ping","at":"2026-11-21T10:00:01.000Z"}\n\n');
    stream.send(
      'data: {"scope":"orders","at":"2026-11-21T10:00:02.000Z"}\n\n',
    );
    await flush();
    expect(received.map((event) => event.scope)).toEqual(['orders']);

    jasmine.clock().tick(45_000);
    http.expectNone((r) => r.url === pollUrl);
  });

  it('si el stream se corta reconecta y recupera desde el último evento', async () => {
    const first = sseStream();
    const second = sseStream();
    fetchSpy.and.returnValues(
      Promise.resolve(first.response),
      Promise.resolve(second.response),
    );

    service.connect();
    await flush();
    http.expectOne((r) => r.url === pollUrl).flush({
      events: [],
      serverTime: '2026-11-21T10:00:00.000Z',
    });
    await flush();

    first.send('data: {"scope":"orders","at":"2026-11-21T10:00:05.000Z"}\n\n');
    first.close();
    await flush();
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    jasmine.clock().tick(1_000);
    await flush();
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    const recovery = http.expectOne((r) => r.url === pollUrl);
    expect(recovery.request.params.get('since')).toBe(
      '2026-11-21T10:00:05.000Z',
    );
    recovery.flush({ events: [], serverTime: '2026-11-21T10:00:06.000Z' });
  });

  it('sin stream sigue polleando cada 15 s', async () => {
    fetchSpy.and.rejectWith(new TypeError('sin red'));

    service.connect();
    await flush();
    http.expectOne((r) => r.url === pollUrl).flush({
      events: [],
      serverTime: '2026-11-21T10:00:00.000Z',
    });
    await flush();

    // Los reintentos del stream (1 s, 2 s, 5 s) siguen fallando.
    for (let i = 0; i < 15; i++) {
      jasmine.clock().tick(1_000);
      await flush();
    }
    expect(fetchSpy).toHaveBeenCalledTimes(4);
    http.expectOne((r) => r.url === pollUrl).flush({
      events: [],
      serverTime: '2026-11-21T10:00:15.000Z',
    });
  });
});
