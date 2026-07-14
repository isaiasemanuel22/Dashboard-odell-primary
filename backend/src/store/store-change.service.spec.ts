import { RealtimeService } from '../realtime/realtime.service';
import { StorePersistenceService } from './store-persistence.service';
import { StoreChangeService } from './store-change.service';

describe('StoreChangeService', () => {
  it('programa persistencia y notifica realtime', () => {
    const persistence = {
      schedulePersist: jest.fn(),
    } as unknown as StorePersistenceService;
    const realtime = {
      notify: jest.fn(),
    } as unknown as RealtimeService;
    const service = new StoreChangeService(persistence, realtime);

    service.recordChange({
      collections: ['customers'],
      realtime: {
        scopes: ['customers'],
        action: 'create',
        entity: 'customer',
        id: 'cust-1',
      },
    });

    expect(persistence.schedulePersist).toHaveBeenCalledWith(['customers']);
    expect(realtime.notify).toHaveBeenCalledWith(['customers'], {
      action: 'create',
      entity: 'customer',
      id: 'cust-1',
    });
  });

  it('puede omitir persistencia en notifyAll', () => {
    const persistence = {
      schedulePersist: jest.fn(),
    } as unknown as StorePersistenceService;
    const realtime = {
      notify: jest.fn(),
    } as unknown as RealtimeService;
    const service = new StoreChangeService(persistence, realtime);

    service.notifyAll('update');

    expect(persistence.schedulePersist).not.toHaveBeenCalled();
    expect(realtime.notify).toHaveBeenCalledWith(['all'], {
      action: 'update',
      entity: undefined,
      id: undefined,
    });
  });
});
