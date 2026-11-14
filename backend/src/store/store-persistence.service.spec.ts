import { StorePersistenceService } from './store-persistence.service';

type Internals = {
  dbEnabled: boolean;
  dirtyCollections: Set<string>;
  persistQueued: boolean;
  persistTimer: ReturnType<typeof setTimeout> | null;
  saveStatePartial: jest.Mock;
  persistNow: (collections: string[]) => Promise<void>;
};

function createService() {
  const store = { toState: jest.fn().mockReturnValue({}) };
  const service = new StorePersistenceService(
    {} as never,
    store as never,
    {} as never,
  );
  const internals = service as unknown as Internals;
  internals.dbEnabled = true;
  internals.saveStatePartial = jest.fn();
  return { service, internals };
}

describe('StorePersistenceService.persistNow', () => {
  afterEach(() => jest.useRealTimers());

  it('serializa guardados simultáneos en orden', async () => {
    const { internals } = createService();
    const events: string[] = [];
    let releaseFirst!: () => void;
    internals.saveStatePartial
      .mockImplementationOnce(async () => {
        events.push('start1');
        await new Promise<void>((resolve) => (releaseFirst = resolve));
        events.push('end1');
      })
      .mockImplementationOnce(() => {
        events.push('start2');
        events.push('end2');
        return Promise.resolve();
      });

    const first = internals.persistNow(['printJobs']);
    const second = internals.persistNow(['printJobs']);
    await Promise.resolve();
    await Promise.resolve();
    expect(events).toEqual(['start1']);

    releaseFirst();
    await Promise.all([first, second]);
    expect(events).toEqual(['start1', 'end1', 'start2', 'end2']);
  });

  it('un fallo vuelve a encolar las colecciones y reintenta', async () => {
    jest.useFakeTimers();
    const { service, internals } = createService();
    internals.saveStatePartial
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(undefined);

    await internals.persistNow(['printJobs', 'orders']);

    expect(service.getStatus().healthy).toBe(false);
    expect(internals.persistQueued).toBe(true);
    expect([...internals.dirtyCollections].sort()).toEqual([
      'orders',
      'printJobs',
    ]);

    await jest.advanceTimersByTimeAsync(500);
    expect(internals.saveStatePartial).toHaveBeenCalledTimes(2);
    expect(service.getStatus().healthy).toBe(true);
    expect(internals.persistQueued).toBe(false);
  });
});
