import { MachineProfile } from '../../../core/models';

/**
 * Al refrescar settings desde el store, conserva las versiones locales
 * de los perfiles marcados dirty y toma del store el resto.
 */
export function mergeMachineProfilesPreservingDirty(
  storeProfiles: MachineProfile[],
  localProfiles: MachineProfile[],
  dirtyIds: ReadonlySet<string>,
): MachineProfile[] {
  const localById = new Map(localProfiles.map((profile) => [profile.id, profile]));
  const storeIds = new Set(storeProfiles.map((profile) => profile.id));

  const merged = storeProfiles.map((storeProfile) => {
    if (dirtyIds.has(storeProfile.id) && localById.has(storeProfile.id)) {
      return localById.get(storeProfile.id)!;
    }
    return storeProfile;
  });

  const localOnly = localProfiles.filter(
    (profile) => !storeIds.has(profile.id) && dirtyIds.has(profile.id),
  );

  return [...merged, ...localOnly];
}

/** Perfiles dirty con nombre, listos para PATCH/POST. */
export function selectDirtyMachineProfilesForSave(
  profiles: MachineProfile[],
  dirtyIds: ReadonlySet<string>,
): MachineProfile[] {
  return profiles.filter(
    (profile) => dirtyIds.has(profile.id) && !!profile.name.trim(),
  );
}
