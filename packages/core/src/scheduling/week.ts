// A brand's week for the calendar (docs/PRD.md RF-30, phase 4 T3): Monday to Sunday in the
// brand's zone, each day with its slot times (and the post planned in each) plus the posts planned
// at other times. Pure: the page reads slots and posts and this lays them out.

import type { PostStatus } from "../posts/constants";
import { parseLocalTime, type Slot, type Weekday } from "./slots";
import { wallClock, zonedToUtc } from "./zoned";

/** Posts whose planned time can move on the calendar. Approved or scheduled ones are (re)scheduled;
 * the ones still being written or reviewed only change their planned time. */
export const MOVABLE_STATUSES: readonly PostStatus[] = [
  "generating",
  "rendering",
  "in_review",
  "approved",
  "scheduled",
];

/** Posts that only get a planned time when moved: they are scheduled once approved. */
export const PLANNABLE_STATUSES: readonly PostStatus[] = ["generating", "rendering", "in_review"];

export function isMovable(status: PostStatus): boolean {
  return MOVABLE_STATUSES.includes(status);
}

const pad = (n: number) => String(n).padStart(2, "0");

function parseDate(date: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const check = new Date(Date.UTC(year, month - 1, day));
  return check.getUTCMonth() === month - 1 && check.getUTCDate() === day
    ? { year, month, day }
    : null;
}

/** "YYYY-MM-DD" plus some days (calendar arithmetic, no time zone involved). */
export function addDays(date: string, days: number): string {
  const parsed = parseDate(date);
  if (!parsed) throw new Error(`Fecha inválida: ${date}`);
  const at = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + days, 12));
  return `${at.getUTCFullYear()}-${pad(at.getUTCMonth() + 1)}-${pad(at.getUTCDate())}`;
}

/** The local date of an instant in a zone, "YYYY-MM-DD". */
export function localDateOf(at: Date, timeZone: string): string {
  const w = wallClock(at, timeZone);
  return `${w.year}-${pad(w.month)}-${pad(w.day)}`;
}

/**
 * The Monday of the week a date falls in. `date` may be any "YYYY-MM-DD" (e.g. from the URL); an
 * invalid one means the current week in the brand's zone.
 */
export function weekMonday(date: string | undefined, now: Date, timeZone: string): string {
  const base = date && parseDate(date) ? date : localDateOf(now, timeZone);
  const parsed = parseDate(base) as { year: number; month: number; day: number };
  const weekday = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day, 12)).getUTCDay();
  return addDays(base, -((weekday + 6) % 7));
}

/** The instants a week starts and ends in the brand's zone (Monday 00:00 to next Monday 00:00). */
export function weekRange(monday: string, timeZone: string): { from: Date; to: Date } {
  const start = parseDate(monday);
  const end = parseDate(addDays(monday, 7));
  if (!start || !end) throw new Error(`Fecha inválida: ${monday}`);
  return {
    from: zonedToUtc({ ...start, hour: 0, minute: 0 }, timeZone),
    to: zonedToUtc({ ...end, hour: 0, minute: 0 }, timeZone),
  };
}

export type CalendarPost = {
  id: string;
  status: PostStatus;
  /** Planned time, or when it was published if it never had one. */
  at: Date;
};

export type CalendarEntry<P extends CalendarPost> = {
  at: Date;
  localTime: string;
  /** The brand slot it is; null for a post planned at another time. */
  slotId: string | null;
  post: P | null;
  /** Already passed: nothing can be moved here. */
  past: boolean;
};

export type CalendarDay<P extends CalendarPost> = {
  localDate: string;
  weekday: Weekday;
  isToday: boolean;
  entries: CalendarEntry<P>[];
};

/**
 * Lays a week out: each day's active slot times with the post planned in each (or free), plus the
 * posts at other times (picked by hand, or a paused or deleted slot). Oldest first per day.
 */
export function buildWeek<P extends CalendarPost>(input: {
  monday: string;
  timeZone: string;
  slots: readonly Slot[];
  posts: readonly P[];
  now: Date;
}): CalendarDay<P>[] {
  const today = localDateOf(input.now, input.timeZone);
  const byTime = new Map(input.posts.map((post) => [post.at.getTime(), post]));
  const placed = new Set<string>();
  const days: CalendarDay<P>[] = [];

  for (let offset = 0; offset < 7; offset++) {
    const localDate = addDays(input.monday, offset);
    const date = parseDate(localDate) as { year: number; month: number; day: number };
    const weekday = new Date(
      Date.UTC(date.year, date.month - 1, date.day, 12),
    ).getUTCDay() as Weekday;
    const entries: CalendarEntry<P>[] = [];
    for (const slot of input.slots) {
      const time = parseLocalTime(slot.localTime);
      if (!slot.active || slot.weekday !== weekday || !time) continue;
      const at = zonedToUtc({ ...date, ...time }, input.timeZone);
      const post = byTime.get(at.getTime()) ?? null;
      if (post) placed.add(post.id);
      entries.push({
        at,
        localTime: `${pad(time.hour)}:${pad(time.minute)}`,
        slotId: slot.id,
        post,
        past: at <= input.now,
      });
    }
    days.push({ localDate, weekday, isToday: localDate === today, entries });
  }

  // Posts not on a slot of the week: their own entry on their day.
  for (const post of input.posts) {
    if (placed.has(post.id)) continue;
    const day = days.find((d) => d.localDate === localDateOf(post.at, input.timeZone));
    if (!day) continue;
    const w = wallClock(post.at, input.timeZone);
    day.entries.push({
      at: post.at,
      localTime: `${pad(w.hour)}:${pad(w.minute)}`,
      slotId: null,
      post,
      past: post.at <= input.now,
    });
  }
  for (const day of days) day.entries.sort((a, b) => a.at.getTime() - b.at.getTime());
  return days;
}
