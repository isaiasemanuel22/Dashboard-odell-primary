import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { CurrentUserProfile } from '../common/interfaces';
import { AppConfigService } from '../config/app-config.service';
import { StoreChangeService } from '../store/store-change.service';
import { StorePersistenceService } from '../store/store-persistence.service';
import { StoreService } from '../store/store.service';
import { SettingsService } from './settings.service';

describe('SettingsService.resetDatabase', () => {
  const admin: CurrentUserProfile = {
    id: 'user-admin',
    email: 'admin@test.com',
    displayName: 'Admin',
    active: true,
    roleIds: ['role-admin'],
    permissionOverrides: [],
    createdAt: '',
    updatedAt: '',
    roles: [],
    permissions: [],
    isAdmin: true,
  };

  const nonAdmin: CurrentUserProfile = {
    ...admin,
    id: 'user-op',
    isAdmin: false,
  };

  let clearDatabase: jest.Mock;
  let notifyAll: jest.Mock;
  let config: { databaseResetCode?: string };
  let service: SettingsService;

  beforeEach(() => {
    clearDatabase = jest.fn().mockResolvedValue(undefined);
    notifyAll = jest.fn();
    config = { databaseResetCode: 'secret-code' };

    service = new SettingsService(
      {} as StoreService,
      { clearDatabase } as unknown as StorePersistenceService,
      { notifyAll, recordChange: jest.fn() } as unknown as StoreChangeService,
      config as unknown as AppConfigService,
    );
  });

  it('no admin → 403', async () => {
    await expect(
      service.resetDatabase('secret-code', nonAdmin),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.resetDatabase('secret-code', nonAdmin),
    ).rejects.toThrow('Solo un administrador puede resetear la base');
    expect(clearDatabase).not.toHaveBeenCalled();
  });

  it('sin env → 403', async () => {
    config.databaseResetCode = undefined;

    await expect(service.resetDatabase('secret-code', admin)).rejects.toThrow(
      'El reseteo de la base está deshabilitado',
    );
    expect(clearDatabase).not.toHaveBeenCalled();
  });

  it('código incorrecto → 400', async () => {
    await expect(
      service.resetDatabase('wrong-code!!', admin),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.resetDatabase('wrong-code!!', admin)).rejects.toThrow(
      'Código de confirmación incorrecto',
    );
    expect(clearDatabase).not.toHaveBeenCalled();
  });

  it('admin + código correcto → llama al reset', async () => {
    await expect(service.resetDatabase('secret-code', admin)).resolves.toEqual({
      reset: true,
    });
    expect(clearDatabase).toHaveBeenCalledTimes(1);
    expect(notifyAll).toHaveBeenCalledWith('update');
  });
});
