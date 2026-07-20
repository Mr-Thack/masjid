export type PrayerName = 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';

export interface MasjidLocation {
  calculation_method: number;
  latitude: number;
  longitude: number;
  timezone: string;
}

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDegrees(rad: number): number {
  return (rad * 180) / Math.PI;
}

function julianDate(date: Date): number {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  const d = date.getUTCDate();
  const a = Math.floor((14 - m) / 12);
  const year = y + 4800 - a;
  const month = m + 12 * a - 3;
  return d + Math.floor((153 * month + 2) / 5) + 365 * year + Math.floor(year / 4) - Math.floor(year / 100) + Math.floor(year / 400) - 32045;
}

function sunDeclination(jd: number): number {
  const T = (jd - 2451545.0) / 36525;
  const epsilon = 23.439291 - 0.0130042 * T;
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  const M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
  const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(toRadians(M)) + (0.019993 - 0.000101 * T) * Math.sin(toRadians(2 * M)) + 0.000289 * Math.sin(toRadians(3 * M));
  const lambda = L0 + C;
  return toDegrees(Math.asin(Math.sin(toRadians(epsilon)) * Math.sin(toRadians(lambda))));
}

function equationOfTime(jd: number): number {
  const T = (jd - 2451545.0) / 36525;
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  const M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
  const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(toRadians(M)) + (0.019993 - 0.000101 * T) * Math.sin(toRadians(2 * M)) + 0.000289 * Math.sin(toRadians(3 * M));
  const alpha = L0 + C;
  const deltaPsi = -0.000319 * Math.sin(toRadians(125.04 - 1934.136 * T)) - 0.000024 * Math.sin(toRadians(2 * (L0 + C)));
  const epsilon = 23.439291 - 0.0130042 * T + deltaPsi / 3600;
  const y = Math.tan(toRadians(epsilon / 2)) ** 2;
  const eotY = y * Math.sin(2 * toRadians(L0)) - 2 * 0.0167086 * Math.sin(toRadians(M)) + 4 * 0.0167086 * y * Math.sin(toRadians(M)) * Math.cos(2 * toRadians(L0)) - 0.5 * y * y * Math.sin(4 * toRadians(L0)) - 1.25 * 0.0167086 * 0.0167086 * Math.sin(toRadians(2 * M));
  return toDegrees(eotY) * 4;
}

function sunAngleTime(
  angle: number,
  lat: number,
  decl: number,
  eot: number,
  lng: number,
  rising: boolean,
): number {
  const latRad = toRadians(lat);
  const declRad = toRadians(decl);
  const numerator = Math.sin(toRadians(angle)) - Math.sin(latRad) * Math.sin(declRad);
  const denominator = Math.cos(latRad) * Math.cos(declRad);
  const cosHA = numerator / denominator;
  if (Math.abs(cosHA) > 1) return NaN;
  let ha = toDegrees(Math.acos(cosHA));
  if (rising) ha = ha * -1;
  const solarNoon = (720 - 4 * lng - eot) / 1440;
  return solarNoon + ha / 360;
}

/**
 * Convert a UTC day-fraction (0 = UTC midnight of `date`) to a local
 * "HH:MM" string for the masjid's IANA timezone.
 */
function utcFractionToLocalHM(dayFraction: number, utcDate: Date, timeZone: string): string {
  if (!Number.isFinite(dayFraction)) return '--:--';

  const base = new Date(
    Date.UTC(utcDate.getUTCFullYear(), utcDate.getUTCMonth(), utcDate.getUTCDate(), 0, 0, 0),
  );
  base.setUTCMinutes(Math.round(dayFraction * 1440));

  const parts = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
    timeZone,
  }).formatToParts(base);

  const hourPart = parts.find((p) => p.type === 'hour')?.value;
  const minutePart = parts.find((p) => p.type === 'minute')?.value;
  if (!hourPart || !minutePart) return '--:--';

  let hour = Number(hourPart);
  // Some ICU implementations emit 24:00 for midnight.
  if (hour === 24) hour = 0;
  return `${String(hour).padStart(2, '0')}:${minutePart}`;
}

/**
 * @deprecated Kept for tests that still expect a raw fractional-day formatter.
 */
function minutesToHM(minutes: number): string {
  if (isNaN(minutes) || !isFinite(minutes)) return '--:--';
  const totalMinutes = Math.round(((minutes % 1) + 1440) % 1 * 1440);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function getAngle(method: number, prayer: PrayerName): number {
  const angles: Record<number, { fajr: number; isha: number }> = {
    1: { fajr: 15.0, isha: 15.0 },
    2: { fajr: 15.0, isha: 15.0 },
    3: { fajr: 18.0, isha: 17.0 },
    4: { fajr: 18.5, isha: -1 },
    5: { fajr: 19.5, isha: 17.5 },
    7: { fajr: 12.0, isha: 12.0 },
  };
  const m = angles[method] ?? angles[2]!;
  if (prayer === 'fajr') return -m.fajr;
  if (prayer === 'isha') return m.isha >= 0 ? -m.isha : m.isha;
  return 0;
}

function asrFactor(method: number): number {
  return 1;
}

export function calculateAdhaan(
  masjid: MasjidLocation,
  date: Date,
): Record<Exclude<PrayerName, 'sunrise'> | 'sunrise', string> {
  const jd = julianDate(date);
  const decl = sunDeclination(jd);
  const eot = equationOfTime(jd);
  const lat = masjid.latitude;
  const lng = masjid.longitude;
  const method = masjid.calculation_method;
  const timeZone = masjid.timezone;

  const sunriseTime = sunAngleTime(-0.833, lat, decl, eot, lng, true);
  const dhuhrTime = (720 - 4 * lng - eot) / 1440;
  const asrAngle = 90 - toDegrees(Math.atan(1 / (asrFactor(method) + Math.tan(toRadians(Math.abs(lat - decl))))));
  const asrTime = sunAngleTime(asrAngle, lat, decl, eot, lng, false);
  const maghribTime = sunAngleTime(-0.833, lat, decl, eot, lng, false);
  const fajrAngle = getAngle(method, 'fajr');
  const fajrTime = sunAngleTime(fajrAngle, lat, decl, eot, lng, true);
  const ishaAngle = getAngle(method, 'isha');
  let ishaTime: number;
  if (ishaAngle >= 0) {
    ishaTime = maghribTime + ishaAngle / 1440;
  } else {
    ishaTime = sunAngleTime(ishaAngle, lat, decl, eot, lng, false);
  }

  return {
    fajr: utcFractionToLocalHM(fajrTime, date, timeZone),
    sunrise: utcFractionToLocalHM(sunriseTime, date, timeZone),
    dhuhr: utcFractionToLocalHM(dhuhrTime, date, timeZone),
    asr: utcFractionToLocalHM(asrTime, date, timeZone),
    maghrib: utcFractionToLocalHM(maghribTime, date, timeZone),
    isha: utcFractionToLocalHM(ishaTime, date, timeZone),
  };
}