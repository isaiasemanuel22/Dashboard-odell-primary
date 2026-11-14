import { resolveOrderResponsible } from './quote-responsible.util';

describe('resolveOrderResponsible', () => {
  it('usa el actor si existe', async () => {
    const list = jest.fn();
    expect(await resolveOrderResponsible(' uid-1 ', list)).toBe('uid-1');
    expect(list).not.toHaveBeenCalled();
  });

  it('asigna el único usuario activo', async () => {
    expect(
      await resolveOrderResponsible(undefined, () =>
        Promise.resolve([{ firebaseUid: 'local:u1' }]),
      ),
    ).toBe('local:u1');
  });

  it('deja vacío con varios o ninguno o error', async () => {
    const two = [{ firebaseUid: 'a' }, { firebaseUid: 'b' }];
    expect(
      await resolveOrderResponsible(undefined, () => Promise.resolve(two)),
    ).toBeUndefined();
    expect(
      await resolveOrderResponsible(undefined, () => Promise.resolve([])),
    ).toBeUndefined();
    expect(
      await resolveOrderResponsible(undefined, () =>
        Promise.reject(new Error('x')),
      ),
    ).toBeUndefined();
  });
});
