import { describe, expect, it } from "vitest";
import {
  normalizeLocalTime,
  parseLocalTime,
  postsPerWeek,
  type Slot,
  upcomingSlots,
} from "./slots";
import { zonedToUtc } from "./zoned";

const BA = "America/Argentina/Buenos_Aires";
const MADRID = "Europe/Madrid";

describe("local times", () => {
  it("reads HH:MM and the HH:MM:SS of a Postgres time", () => {
    expect(parseLocalTime("19:00")).toEqual({ hour: 19, minute: 0 });
    expect(parseLocalTime("07:05:00")).toEqual({ hour: 7, minute: 5 });
    expect(normalizeLocalTime(" 09:30 ")).toBe("09:30");
  });

  it("rejects what is not a time of the day", () => {
    for (const text of ["24:00", "7:00", "19:60", "19", "", "19:00:30", "ab:cd"]) {
      expect(parseLocalTime(text)).toBeNull();
    }
  });
});

describe("zonedToUtc", () => {
  it("turns a wall-clock time of Buenos Aires into UTC (UTC-3)", () => {
    expect(
      zonedToUtc({ year: 2026, month: 9, day: 28, hour: 19, minute: 0 }, BA).toISOString(),
    ).toBe("2026-09-28T22:00:00.000Z");
    // After 21:00 in Buenos Aires it is already the next day in UTC.
    expect(
      zonedToUtc({ year: 2026, month: 9, day: 28, hour: 21, minute: 30 }, BA).toISOString(),
    ).toBe("2026-09-29T00:30:00.000Z");
  });

  it("follows the offset of each date in a zone with DST", () => {
    expect(
      zonedToUtc({ year: 2026, month: 1, day: 15, hour: 19, minute: 0 }, MADRID).toISOString(),
    ).toBe("2026-01-15T18:00:00.000Z");
    expect(
      zonedToUtc({ year: 2026, month: 7, day: 15, hour: 19, minute: 0 }, MADRID).toISOString(),
    ).toBe("2026-07-15T17:00:00.000Z");
  });

  it("moves a time skipped by DST forward and takes the first of a repeated one", () => {
    // 29/03/2026 in Madrid: 02:00 jumps to 03:00, so 02:30 happens at 03:30.
    expect(
      zonedToUtc({ year: 2026, month: 3, day: 29, hour: 2, minute: 30 }, MADRID).toISOString(),
    ).toBe("2026-03-29T01:30:00.000Z");
    // 25/10/2026: 03:00 goes back to 02:00, so 02:30 happens twice; the first one is in summer time.
    expect(
      zonedToUtc({ year: 2026, month: 10, day: 25, hour: 2, minute: 30 }, MADRID).toISOString(),
    ).toBe("2026-10-25T00:30:00.000Z");
  });
});

describe("upcomingSlots", () => {
  const slot = (id: string, weekday: number, localTime: string, active = true): Slot => ({
    id,
    weekday,
    localTime,
    active,
  });

  // Friday 25/09/2026 at 18:00 in Buenos Aires.
  const from = new Date("2026-09-25T21:00:00Z");

  it("lists the next 7 days in the brand's zone, oldest first, from now on", () => {
    const slots = [
      slot("daily-19", 5, "19:00"),
      ...[6, 0, 1, 2, 3, 4].map((d) => slot(`d${d}`, d, "19:00")),
    ];
    const next = upcomingSlots(slots, { from, days: 7, timeZone: BA });
    expect(next.map((o) => `${o.localDate} ${o.localTime}`)).toEqual([
      "2026-09-25 19:00",
      "2026-09-26 19:00",
      "2026-09-27 19:00",
      "2026-09-28 19:00",
      "2026-09-29 19:00",
      "2026-09-30 19:00",
      "2026-10-01 19:00",
    ]);
    expect(next[0]?.at.toISOString()).toBe("2026-09-25T22:00:00.000Z");
    expect(next[0]?.weekday).toBe(5);
  });

  it("skips what already happened today and paused slots", () => {
    const slots = [slot("a", 5, "14:00"), slot("b", 5, "20:00"), slot("c", 6, "10:00", false)];
    const next = upcomingSlots(slots, { from, days: 2, timeZone: BA });
    expect(next.map((o) => o.slotId)).toEqual(["b"]);
  });

  it("uses the local weekday, not the UTC one", () => {
    // 22:00 UTC of Sunday 27/09 is still Sunday 19:00 in Buenos Aires, not Monday.
    const late = new Date("2026-09-27T21:30:00Z");
    const next = upcomingSlots([slot("sun", 0, "21:00"), slot("mon", 1, "09:00")], {
      from: late,
      days: 2,
      timeZone: BA,
    });
    expect(next.map((o) => `${o.slotId} ${o.localDate}`)).toEqual([
      "sun 2026-09-27",
      "mon 2026-09-28",
    ]);
    expect(next[0]?.at.toISOString()).toBe("2026-09-28T00:00:00.000Z");
  });

  it("keeps the wall-clock time across a DST change", () => {
    // Week of the change in Madrid: 19:00 is 18:00 UTC on Saturday and 17:00 UTC on Sunday.
    const next = upcomingSlots([slot("sat", 6, "19:00"), slot("sun", 0, "19:00")], {
      from: new Date("2026-03-27T12:00:00Z"),
      days: 3,
      timeZone: MADRID,
    });
    expect(next.map((o) => o.at.toISOString())).toEqual([
      "2026-03-28T18:00:00.000Z",
      "2026-03-29T17:00:00.000Z",
    ]);
  });

  it("counts the active slots of a week", () => {
    expect(postsPerWeek([slot("a", 1, "19:00"), slot("b", 2, "19:00", false)])).toBe(1);
  });
});
