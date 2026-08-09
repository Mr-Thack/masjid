const KEY = 'masjid-device-theme';

export type DevicePreference = 'auto' | 'light' | 'dark';

let _pref = $state<DevicePreference>('auto');
let _loaded = false;

function load() {
  if (_loaded || typeof localStorage === 'undefined') return;
  _loaded = true;
  const stored = localStorage.getItem(KEY);
  if (stored === 'light' || stored === 'dark') _pref = stored;
}

load();

export const deviceThemePref = {
  get current(): DevicePreference {
    load();
    return _pref;
  },
  set current(val: DevicePreference) {
    load();
    _pref = val;
    try {
      if (val === 'auto') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, val);
    } catch { /* quota exceeded, ignore */ }
  },
  next(): DevicePreference {
    const cycle: DevicePreference[] = ['auto', 'light', 'dark'];
    const idx = cycle.indexOf(this.current);
    const next = cycle[(idx + 1) % cycle.length];
    this.current = next;
    return next;
  },
  /** Resolve the effective mode: auto → admin setting, light/dark → override. */
  resolve(adminMode: 'dark' | 'light'): 'dark' | 'light' {
    load();
    return _pref === 'auto' ? adminMode : _pref;
  },
};