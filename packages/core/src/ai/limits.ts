// Usage limits of AI generation (docs/ARCHITECTURE.md §7, "Límites de uso"): each brand's own
// caps per day and per month, and the backoff when a provider hits its limit.

export type AiQuota = {
  /** Successful generations per day in the brand's time zone. Null: no cap. */
  daily: number | null;
  /** Successful generations per calendar month in the brand's time zone. Null: no cap. */
  monthly: number | null;
};

export type AiQuotaCheck = { ok: true } | { ok: false; period: "day" | "month"; limit: number };

export function checkAiQuota(quota: AiQuota, used: { today: number; month: number }): AiQuotaCheck {
  if (quota.daily !== null && used.today >= quota.daily) {
    return { ok: false, period: "day", limit: quota.daily };
  }
  if (quota.monthly !== null && used.month >= quota.monthly) {
    return { ok: false, period: "month", limit: quota.monthly };
  }
  return { ok: true };
}

/** Wall-clock fields of an instant in a time zone. */
function wallClock(at: Date, timeZone: string) {
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
function zoneOffsetMs(at: Date, timeZone: string): number {
  const w = wallClock(at, timeZone);
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/**
 * Start (as a UTC instant) of the day or month that `now` falls in, in `timeZone`
 * (CLAUDE.md, rule 11: every date function takes the zone explicitly).
 */
export function zonedPeriodStart(now: Date, timeZone: string, period: "day" | "month"): Date {
  const w = wallClock(now, timeZone);
  const localMidnight = Date.UTC(w.year, w.month - 1, period === "day" ? w.day : 1);
  // First guess with today's offset, then again with the offset at that instant (DST changes).
  let start = localMidnight - zoneOffsetMs(now, timeZone);
  start = localMidnight - zoneOffsetMs(new Date(start), timeZone);
  return new Date(start);
}

/** Waits after a provider's limit, by attempt: 15 min, 30, 60, 120, then 240 each time. */
export const RATE_LIMIT_BACKOFF_MINUTES = [15, 30, 60, 120, 240] as const;

/**
 * Delay before retrying a generation that hit a provider's limit. `attempt` counts from 0.
 * When the provider says when the limit resets, it waits at least until then.
 */
export function rateLimitDelayMs(attempt: number, retryAfterMs: number | null): number {
  const steps = RATE_LIMIT_BACKOFF_MINUTES;
  const minutes = steps[Math.min(Math.max(attempt, 0), steps.length - 1)] ?? 240;
  return Math.max(minutes * 60_000, retryAfterMs ?? 0);
}
