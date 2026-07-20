interface HijriDate {
  month: number;
  day: number;
  year: number;
}

const HIJRI_EPOCH = 227015;

function gregorianToJulianDay(y: number, m: number, d: number): number {
  let year = y;
  let month = m;
  if (month <= 2) {
    year -= 1;
    month += 12;
  }
  const A = Math.floor(year / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + d + B - 1524;
}

function kuwaitiAlgorithm(jd: number): HijriDate {
  const l = jd - 1948440 + 10632;
  const n = Math.floor((l - 1) / 10631);
  const l2 = l - 10631 * n;
  const j = Math.floor((l2 + 14) / 10631);
  const j2 = Math.floor((l2 + 2) / 10631);
  if (j !== j2) {
    const year = n + 1;
    const daysSince = l - Math.floor(j2 * 10631 + 1);
    const monthsSince = Math.floor((daysSince * 11) / 354);
    const month = monthsSince + 1;
    const daysInMonths = Math.floor((monthsSince * 354 + (monthsSince <= 6 ? 11 : 10)) / 11);
    const day = daysSince - daysInMonths;
    return { month, day: Math.max(1, day + 1), year };
  }
  const year = n;
  const adjusted = l - Math.floor(j2 * 10631 + 1);
  const monthsSince = Math.floor((adjusted * 11) / 355);
  const month = monthsSince + 1;
  const daysInMonths = Math.floor((monthsSince * 355 + 11) / 12);
  const day = adjusted - daysInMonths;
  return { month, day: Math.max(1, day + 1), year };
}

export function computeHijriDate(gregorianDate: Date): HijriDate {
  const y = gregorianDate.getUTCFullYear();
  const m = gregorianDate.getUTCMonth() + 1;
  const d = gregorianDate.getUTCDate();
  return kuwaitiAlgorithm(gregorianToJulianDay(y, m, d));
}