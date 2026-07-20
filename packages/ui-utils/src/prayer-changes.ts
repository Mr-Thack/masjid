export interface IqaamahSource {
  [prayer: string]: { iqaamah: string } | undefined;
}

export interface DayWithTimes {
  date: string;
  times: IqaamahSource;
}

export interface NearestIqaamahChange {
  date: string;
  prayer: string;
  from: string;
  to: string;
}

/**
 * For each prayer, find the nearest upcoming day whose iqaamah differs from the
 * base day. Returns at most one entry per prayer.
 *
 * This mirrors the algorithm used in the consumer front-end but can operate on
 * any pre-fetched list of upcoming days (e.g. the board endpoint's
 * `upcoming_days`).
 */
export function findNearestIqaamahChanges(
  baseTimes: IqaamahSource,
  upcomingDays: DayWithTimes[],
  prayerOrder: readonly string[],
): NearestIqaamahChange[] {
  const seen = new Set<string>();
  const changes: NearestIqaamahChange[] = [];

  for (const day of upcomingDays) {
    if (seen.size === prayerOrder.length) break;

    for (const prayer of prayerOrder) {
      if (seen.has(prayer)) continue;

      const current = baseTimes[prayer]?.iqaamah;
      const future = day.times[prayer]?.iqaamah;

      if (future && future !== current) {
        changes.push({
          date: day.date,
          prayer,
          from: current ?? '--:--',
          to: future,
        });
        seen.add(prayer);
      }
    }
  }

  return changes;
}
