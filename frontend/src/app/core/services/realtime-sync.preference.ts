const REALTIME_SYNC_STORAGE_KEY = 'dashboard.realtimeSyncEnabled';

export function readRealtimeSyncEnabled(): boolean {
  if (typeof localStorage === 'undefined') {
    return false;
  }
  return localStorage.getItem(REALTIME_SYNC_STORAGE_KEY) === 'true';
}

export function writeRealtimeSyncEnabled(enabled: boolean): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  localStorage.setItem(REALTIME_SYNC_STORAGE_KEY, enabled ? 'true' : 'false');
}
