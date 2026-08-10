const KEY = 'masjid-device-theme';

export type DevicePreference = 'light' | 'dark';

let _pref = $state<DevicePreference | null>(null);

// Read persisted preference at module init, before any reactive context exists.
// This runs on both server (no-op — no localStorage) and client, but on the
// client it executes before components mount, so the $state write is safe.
if (typeof localStorage !== 'undefined') {
  const stored = localStorage.getItem(KEY);
  if (stored === 'light' || stored === 'dark') _pref = stored;
}

export const deviceThemePref = {
  get current(): DevicePreference | null {
    return _pref;
  },
  set current(val: DevicePreference) {
    _pref = val;
    try {
      localStorage.setItem(KEY, val);
    } catch { /* quota exceeded, ignore */ }
  },
  /** Toggle between light and dark, persisting the choice. */
  toggle(): DevicePreference {
    const next = _pref === 'light' ? 'dark' : 'light';
    this.current = next;
    return next;
  },
  /** Resolve the effective mode: user choice overrides admin default. */
  resolve(adminMode: 'dark' | 'light'): 'dark' | 'light' {
    return _pref ?? adminMode;
  },
};