// The studio is not tied to a brand (a video may have none), so it has its own time zone: the
// operator's. Every date function gets it explicitly (rule 11).

export const STUDIO_TIME_ZONE = "America/Argentina/Buenos_Aires";

function zonedParts(at: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    asUtc: Date.UTC(
      get("year"),
      get("month") - 1,
      get("day"),
      get("hour"),
      get("minute"),
      get("second"),
    ),
  };
}

/** The UTC instant of 00:00 of that calendar day in the zone. */
function midnight(year: number, month: number, day: number, timeZone: string): Date {
  const guess = Date.UTC(year, month - 1, day);
  // How far the zone's wall clock is from UTC around that moment.
  const offset = zonedParts(new Date(guess), timeZone).asUtc - guess;
  return new Date(guess - offset);
}

export function startOfDay(at: Date, timeZone: string): Date {
  const { year, month, day } = zonedParts(at, timeZone);
  return midnight(year, month, day, timeZone);
}

export function startOfMonth(at: Date, timeZone: string): Date {
  const { year, month } = zonedParts(at, timeZone);
  return midnight(year, month, 1, timeZone);
}
