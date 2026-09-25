// Publishing slots of a brand (docs/PRD.md RF-06): a weekday and a local time in the brand's time
// zone, e.g. "every Monday at 19:00". They are stored as wall-clock time and turned into UTC
// instants only for a given week (CLAUDE.md, rule 11), so a DST change never moves them.

import { wallClock, zonedToUtc } from "./zoned";

/** 0 = Sunday … 6 = Saturday, as `Date#getUTCDay` and Postgres `extract(dow)`. */
export const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;
export type Weekday = (typeof WEEKDAYS)[number];

/** Order of the week in the panel: Monday first. */
export const WEEK_ORDER: readonly Weekday[] = [1, 2, 3, 4, 5, 6, 0];

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  0: "Domingo",
  1: "Lunes",
  2: "Martes",
  3: "Miércoles",
  4: "Jueves",
  5: "Viernes",
  6: "Sábado",
};

export const WEEKDAY_SHORT: Record<Weekday, string> = {
  0: "Dom",
  1: "Lun",
  2: "Mar",
  3: "Mié",
  4: "Jue",
  5: "Vie",
  6: "Sáb",
};

export function isWeekday(value: number): value is Weekday {
  return Number.isInteger(value) && value >= 0 && value <= 6;
}

const LOCAL_TIME = /^([01]\d|2[0-3]):([0-5]\d)(?::00)?$/;

/** "19:00" (or "19:00:00", as Postgres returns a `time`) → hour and minute. Null if invalid. */
export function parseLocalTime(text: string): { hour: number; minute: number } | null {
  const match = LOCAL_TIME.exec(text.trim());
  if (!match) return null;
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

/** The canonical "HH:MM" of a local time, or null if it is not one. */
export function normalizeLocalTime(text: string): string | null {
  const time = parseLocalTime(text);
  if (!time) return null;
  return `${String(time.hour).padStart(2, "0")}:${String(time.minute).padStart(2, "0")}`;
}

export type Slot = { id: string; weekday: number; localTime: string; active: boolean };

export type SlotOccurrence = {
  slotId: string;
  /** When it happens (UTC). */
  at: Date;
  /** Its date and time in the brand's zone: "2026-09-28" and "19:00". */
  localDate: string;
  localTime: string;
  weekday: Weekday;
};

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * The active slots that happen after `from` in the next `days` calendar days of the brand's zone,
 * counting today (docs/ROADMAP.md, phase 4: `slots.fill` fills 7 days ahead). Oldest first.
 */
export function upcomingSlots(
  slots: readonly Slot[],
  options: { from: Date; days: number; timeZone: string },
): SlotOccurrence[] {
  const today = wallClock(options.from, options.timeZone);
  const occurrences: SlotOccurrence[] = [];
  for (let offset = 0; offset < options.days; offset++) {
    // Calendar arithmetic on the local date, at noon UTC so it never slips a day.
    const date = new Date(Date.UTC(today.year, today.month - 1, today.day + offset, 12));
    const weekday = date.getUTCDay() as Weekday;
    const local = {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
    };
    for (const slot of slots) {
      const time = parseLocalTime(slot.localTime);
      if (!slot.active || slot.weekday !== weekday || !time) continue;
      const at = zonedToUtc({ ...local, ...time }, options.timeZone);
      if (at <= options.from) continue;
      occurrences.push({
        slotId: slot.id,
        at,
        localDate: `${local.year}-${pad(local.month)}-${pad(local.day)}`,
        localTime: `${pad(time.hour)}:${pad(time.minute)}`,
        weekday,
      });
    }
  }
  return occurrences.sort((a, b) => a.at.getTime() - b.at.getTime());
}

/** Active slots per week: what the brand publishes when every slot gets a post. */
export function postsPerWeek(slots: readonly Slot[]): number {
  return slots.filter((slot) => slot.active).length;
}
