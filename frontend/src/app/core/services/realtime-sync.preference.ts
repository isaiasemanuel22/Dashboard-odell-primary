const REALTIME_SYNC_STORAGE_KEY = 'dashboard.realtimeSyncEnabled';

/** Activada por defecto; solo se apaga si el dispositivo guardó 'false'. */
export function readRealtimeSyncEnabled(): boolean {
  if (typeof localStorage === 'undefined') {
    return true;
  }
  return localStorage.getItem(REALTIME_SYNC_STORAGE_KEY) !== 'false';
}

export function writeRealtimeSyncEnabled(enabled: boolean): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  localStorage.setItem(REALTIME_SYNC_STORAGE_KEY, enabled ? 'true' : 'false');
}
