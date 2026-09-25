// Wall-clock time in a time zone, by hand over Intl (CLAUDE.md, rule 11: dates are stored in UTC and
// every date function takes the zone explicitly).

export type WallClock = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

/** Wall-clock fields of an instant in a time zone. */
export function wallClock(at: Date, timeZone: string): WallClock {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hourCycle: "h23",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

/** Offset of a time zone at an instant, in ms (local wall clock minus UTC). */
export function zoneOffsetMs(at: Date, timeZone: string): number {
  const w = wallClock(at, timeZone);
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/**
 * The instant a wall-clock time happens in a time zone. A time skipped by a DST change (02:30 when
 * clocks jump from 02:00 to 03:00) moves forward by the jump; a repeated one takes the first.
 */
export function zonedToUtc(
  local: { year: number; month: number; day: number; hour: number; minute: number },
  timeZone: string,
): Date {
  const asUtc = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute);
  // The offsets just before and after: they differ only around a DST change.
  const before = zoneOffsetMs(new Date(asUtc - 86_400_000), timeZone);
  const after = zoneOffsetMs(new Date(asUtc + 86_400_000), timeZone);
  const candidates = [asUtc - before, asUtc - after].filter((at) => {
    const w = wallClock(new Date(at), timeZone);
    return w.hour === local.hour && w.minute === local.minute && w.day === local.day;
  });
  if (candidates.length > 0) return new Date(Math.min(...candidates));
  // Skipped: the wall clock never shows it; the same instant with the earlier offset lands after the jump.
  return new Date(asUtc - before);
}
