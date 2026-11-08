import { actorFromRequest } from './print-job-actor.util';
import { ADMIN_ROLE_ID } from '../users/user-access.bootstrap';

describe('actorFromRequest', () => {
  it('sin user y sin exigir auth → admin local', () => {
    expect(actorFromRequest({}, false)).toEqual({
      userId: undefined,
      isAdmin: true,
    });
  });

  it('sin user y con auth exigida → no admin', () => {
    expect(actorFromRequest({}, true)).toEqual({
      userId: undefined,
      isAdmin: false,
    });
  });

  it('con user y perfil admin → admin', () => {
    const actor = actorFromRequest(
      {
        user: { uid: 'uid-1' } as never,
        appUser: {
          isAdmin: true,
          roleIds: [],
        } as never,
      },
      true,
    );
    expect(actor).toEqual({ userId: 'uid-1', isAdmin: true });
  });

  it('con user y rol admin → admin', () => {
    const actor = actorFromRequest(
      {
        user: { uid: 'uid-2' } as never,
        appUser: {
          isAdmin: false,
          roleIds: [ADMIN_ROLE_ID],
        } as never,
      },
      false,
    );
    expect(actor).toEqual({ userId: 'uid-2', isAdmin: true });
  });

  it('con user sin admin → no admin', () => {
    const actor = actorFromRequest(
      {
        user: { uid: 'uid-3' } as never,
        appUser: {
          isAdmin: false,
          roleIds: ['role-ops'],
        } as never,
      },
      true,
    );
    expect(actor).toEqual({ userId: 'uid-3', isAdmin: false });
  });
});
