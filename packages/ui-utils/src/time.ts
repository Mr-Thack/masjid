export type TimeFormat = '12h' | '24h';

export function formatClockTime(time: string, format: TimeFormat = '24h'): string {
  if (time === '--:--') return time;
  if (format === '24h') return time;

  const [h, m] = time.split(':').map(Number);
  if (h == null || m == null || Number.isNaN(h) || Number.isNaN(m)) return time;

  const period = h >= 12 ? 'PM' : 'AM';
  const displayHour = h % 12 === 0 ? 12 : h % 12;
  return `${displayHour}:${String(m).padStart(2, '0')} ${period}`;
}
