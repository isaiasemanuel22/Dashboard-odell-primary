import { MachineProfile, MachineProfileRole, ProductType } from '../../../core/models';
import {
  mergeMachineProfilesPreservingDirty,
  selectDirtyMachineProfilesForSave,
} from './machine-profiles-dirty.util';

function profile(
  partial: Partial<MachineProfile> & Pick<MachineProfile, 'id' | 'name'>,
): MachineProfile {
  return {
    role: MachineProfileRole.PRINT,
    watts: 100,
    costPerHour: 50,
    productType: ProductType.FDM,
    ...partial,
  };
}

describe('mergeMachineProfilesPreservingDirty', () => {
  it('conserva queueEnabled local dirty cuando el store emite defaults', () => {
    const storeProfiles = [
      profile({ id: 'mp-1', name: 'A1 #1', queueEnabled: false }),
      profile({ id: 'mp-2', name: 'A1 #2', queueEnabled: false }),
    ];
    const localProfiles = [
      profile({
        id: 'mp-1',
        name: 'A1 #1',
        queueEnabled: true,
        amsSlots: ['c1', null, null, null],
      }),
      profile({ id: 'mp-2', name: 'A1 #2', queueEnabled: false }),
    ];
    const dirtyIds = new Set(['mp-1']);

    const merged = mergeMachineProfilesPreservingDirty(
      storeProfiles,
      localProfiles,
      dirtyIds,
    );

    expect(merged.find((p) => p.id === 'mp-1')?.queueEnabled).toBe(true);
    expect(merged.find((p) => p.id === 'mp-1')?.amsSlots).toEqual([
      'c1',
      null,
      null,
      null,
    ]);
    expect(merged.find((p) => p.id === 'mp-2')?.queueEnabled).toBe(false);
  });

  it('agrega perfiles locales dirty que aún no están en el store', () => {
    const storeProfiles = [profile({ id: 'mp-1', name: 'Guardado' })];
    const localProfiles = [
      profile({ id: 'mp-1', name: 'Guardado' }),
      profile({ id: 'tmp-mp-9', name: 'Nuevo', queueEnabled: true }),
    ];

    const merged = mergeMachineProfilesPreservingDirty(
      storeProfiles,
      localProfiles,
      new Set(['tmp-mp-9']),
    );

    expect(merged.map((p) => p.id)).toEqual(['mp-1', 'tmp-mp-9']);
    expect(merged[1].queueEnabled).toBe(true);
  });
});

describe('selectDirtyMachineProfilesForSave', () => {
  it('devuelve solo los dirty con nombre', () => {
    const profiles = [
      profile({ id: 'mp-1', name: 'A', queueEnabled: true }),
      profile({ id: 'mp-2', name: 'B' }),
      profile({ id: 'mp-3', name: '   ' }),
      profile({ id: 'tmp-1', name: 'Nuevo' }),
    ];
    const dirtyIds = new Set(['mp-1', 'mp-3', 'tmp-1']);

    expect(
      selectDirtyMachineProfilesForSave(profiles, dirtyIds).map((p) => p.id),
    ).toEqual(['mp-1', 'tmp-1']);
  });
});
