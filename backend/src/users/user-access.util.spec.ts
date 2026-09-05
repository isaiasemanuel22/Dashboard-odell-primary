import {
  ADMIN_PERMISSION_ACTIONS,
  PermissionAction,
  WORK_PERMISSION_ACTIONS,
} from '../common/enums';
import {
  AppRole,
  AppUser,
  CurrentUserProfile,
  RolePermissionEntry,
  UserPermissionOverrideEntry,
  WorkArea,
} from '../common/interfaces';
import {
  hasPermission,
  resolvePermissions,
  userIsAdmin,
} from './user-access.util';

describe('user-access.util', () => {
  const area3d: WorkArea = {
    id: 'area-3d',
    name: '3D',
    slug: '3d',
    active: true,
    sortOrder: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  const operatorRole: AppRole = {
    id: 'role-op',
    name: 'Operador 3D',
    isSystem: false,
    permissions: [
      { action: PermissionAction.VIEW, areaId: area3d.id },
      { action: PermissionAction.MODIFY, areaId: area3d.id },
    ],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  it('acumula permisos de varios roles', () => {
    const designRole: AppRole = {
      ...operatorRole,
      id: 'role-design',
      name: 'Diseño',
      permissions: [
        { action: PermissionAction.VIEW, areaId: 'area-design' },
      ],
    };

    const resolved = resolvePermissions([operatorRole, designRole], []);
    expect(
      hasPermission(resolved, PermissionAction.VIEW, area3d.id),
    ).toBe(true);
    expect(
      hasPermission(resolved, PermissionAction.VIEW, 'area-design'),
    ).toBe(true);
    expect(
      hasPermission(resolved, PermissionAction.CREATE, area3d.id),
    ).toBe(false);
  });

  it('aplica excepciones deny sobre grants', () => {
    const overrides: UserPermissionOverrideEntry[] = [
      {
        action: PermissionAction.MODIFY,
        areaId: area3d.id,
        granted: false,
      },
    ];

    const resolved = resolvePermissions([operatorRole], overrides);
    expect(
      hasPermission(resolved, PermissionAction.MODIFY, area3d.id),
    ).toBe(false);
    expect(
      hasPermission(resolved, PermissionAction.VIEW, area3d.id),
    ).toBe(true);
  });

  it('detecta administrador con permisos globales', () => {
    const adminPermissions = ADMIN_PERMISSION_ACTIONS.map((action) => ({
      action,
      areaId: null,
      granted: true,
    }));

    expect(userIsAdmin(adminPermissions)).toBe(true);
  });

  it('permiso global de acción aplica a cualquier área', () => {
    const globalView: AppRole = {
      ...operatorRole,
      permissions: [{ action: PermissionAction.VIEW, areaId: null }],
    };

    const resolved = resolvePermissions([globalView], []);
    expect(
      hasPermission(resolved, PermissionAction.VIEW, 'cualquier-area'),
    ).toBe(true);
  });
});

describe('CurrentUserProfile integration', () => {
  it('roles y permisos resueltos se incluyen en el perfil', () => {
    const user: AppUser = {
      id: 'user-1',
      email: 'op@odell.test',
      displayName: 'Operador',
      active: true,
      roleIds: ['role-op'],
      permissionOverrides: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    const role: AppRole = {
      id: 'role-op',
      name: 'Operador',
      isSystem: false,
      permissions: WORK_PERMISSION_ACTIONS.map((action) => ({
        action,
        areaId: 'area-3d',
      })),
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    const permissions = resolvePermissions([role], user.permissionOverrides);
    const profile: CurrentUserProfile = {
      ...user,
      roles: [role],
      permissions,
      isAdmin: userIsAdmin(permissions),
    };

    expect(profile.isAdmin).toBe(false);
    expect(profile.permissions.length).toBe(WORK_PERMISSION_ACTIONS.length);
  });
});
