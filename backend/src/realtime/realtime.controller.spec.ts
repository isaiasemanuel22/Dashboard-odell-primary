import { MessageEvent } from '@nestjs/common';
import { Subscription } from 'rxjs';
import { RealtimeController, STREAM_HEARTBEAT_MS } from './realtime.controller';
import { RealtimeService } from './realtime.service';

describe('RealtimeController stream', () => {
  let service: RealtimeService;
  let controller: RealtimeController;
  let received: MessageEvent[];
  let subscription: Subscription;

  beforeEach(() => {
    jest.useFakeTimers();
    service = new RealtimeService();
    controller = new RealtimeController(service);
    received = [];
    subscription = controller
      .stream()
      .subscribe((message) => received.push(message));
  });

  afterEach(() => {
    subscription.unsubscribe();
    jest.useRealTimers();
  });

  it('emite el evento tras notify', () => {
    jest.advanceTimersByTime(0);
    received = [];

    service.notify('orders', { action: 'update', entity: 'order', id: 'o1' });

    expect(received).toHaveLength(1);
    expect(received[0].data).toEqual(
      expect.objectContaining({
        scope: 'orders',
        action: 'update',
        entity: 'order',
        id: 'o1',
        at: expect.any(String) as string,
      }),
    );
  });

  it('manda un ping al conectar y después cada 25 s', () => {
    jest.advanceTimersByTime(0);
    expect(received).toHaveLength(1);
    expect(received[0].data).toEqual(expect.objectContaining({ type: 'ping' }));

    jest.advanceTimersByTime(STREAM_HEARTBEAT_MS);
    expect(received).toHaveLength(2);
    expect(received[1].data).toEqual(expect.objectContaining({ type: 'ping' }));
  });

  it('deja de emitir al cerrar la conexión', () => {
    subscription.unsubscribe();
    service.notify('orders');
    jest.advanceTimersByTime(STREAM_HEARTBEAT_MS);
    expect(received).toHaveLength(0);
  });
});
