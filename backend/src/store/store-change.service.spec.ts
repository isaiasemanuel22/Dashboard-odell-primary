import { RealtimeService } from '../realtime/realtime.service';
import { StorePersistenceService } from './store-persistence.service';
import { StoreChangeService } from './store-change.service';

describe('StoreChangeService', () => {
  it('programa persistencia y notifica realtime', () => {
    const schedulePersist = jest.fn();
    const notify = jest.fn();
    const persistence = {
      schedulePersist,
    } as unknown as StorePersistenceService;
    const realtime = {
      notify,
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

    expect(schedulePersist).toHaveBeenCalledWith(['customers']);
    expect(notify).toHaveBeenCalledWith(['customers'], {
      action: 'create',
      entity: 'customer',
      id: 'cust-1',
    });
  });

  it('puede omitir persistencia en notifyAll', () => {
    const schedulePersist = jest.fn();
    const notify = jest.fn();
    const persistence = {
      schedulePersist,
    } as unknown as StorePersistenceService;
    const realtime = {
      notify,
    } as unknown as RealtimeService;
    const service = new StoreChangeService(persistence, realtime);

    service.notifyAll('update');

    expect(schedulePersist).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith(['all'], {
      action: 'update',
      entity: undefined,
      id: undefined,
    });
  });
});
