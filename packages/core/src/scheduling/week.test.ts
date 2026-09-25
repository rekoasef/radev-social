import { describe, expect, it } from "vitest";
import type { Slot } from "./slots";
import { addDays, buildWeek, isMovable, localDateOf, weekMonday, weekRange } from "./week";

const BA = "America/Argentina/Buenos_Aires";

describe("week dates", () => {
  // Friday 25/09/2026, 18:00 in Buenos Aires.
  const now = new Date("2026-09-25T21:00:00Z");

  it("finds the Monday of a week, in the brand's zone by default", () => {
    expect(weekMonday(undefined, now, BA)).toBe("2026-09-21");
    expect(weekMonday("2026-09-27", now, BA)).toBe("2026-09-21");
    expect(weekMonday("2026-09-28", now, BA)).toBe("2026-09-28");
    expect(weekMonday("2026-02-30", now, BA)).toBe("2026-09-21");
    expect(weekMonday("hola", now, BA)).toBe("2026-09-21");
    // 22:00 of Sunday in Buenos Aires is already Monday in UTC: still Sunday's week.
    expect(weekMonday(undefined, new Date("2026-09-28T01:00:00Z"), BA)).toBe("2026-09-21");
  });

  it("adds days across months and years", () => {
    expect(addDays("2026-12-28", 7)).toBe("2027-01-04");
    expect(addDays("2026-03-02", -7)).toBe("2026-02-23");
  });

  it("gives the week's range in UTC", () => {
    expect(weekRange("2026-09-21", BA)).toEqual({
      from: new Date("2026-09-21T03:00:00Z"),
      to: new Date("2026-09-28T03:00:00Z"),
    });
    expect(localDateOf(new Date("2026-09-28T02:59:00Z"), BA)).toBe("2026-09-27");
  });
});

describe("buildWeek", () => {
  const slot = (id: string, weekday: number, localTime: string, active = true): Slot => ({
    id,
    weekday,
    localTime,
    active,
  });
  const slots = [slot("mon", 1, "19:00"), slot("fri", 5, "19:00"), slot("sat", 6, "10:00", false)];
  const now = new Date("2026-09-25T21:00:00Z");

  it("puts each post in its slot and leaves the others free", () => {
    const post = { id: "a", status: "scheduled" as const, at: new Date("2026-09-21T22:00:00Z") };
    const week = buildWeek({ monday: "2026-09-21", timeZone: BA, slots, posts: [post], now });
    expect(week).toHaveLength(7);
    expect(week[0]?.entries).toEqual([
      { at: post.at, localTime: "19:00", slotId: "mon", post, past: true },
    ]);
    // Friday 19:00 is still ahead at 18:00.
    expect(week[4]).toMatchObject({
      isToday: true,
      entries: [{ slotId: "fri", post: null, past: false }],
    });
    // A paused slot is not offered.
    expect(week[5]?.entries).toEqual([]);
  });

  it("adds posts planned at other times on their local day, in order", () => {
    const early = { id: "b", status: "approved" as const, at: new Date("2026-09-25T13:30:00Z") };
    // 23:30 in Buenos Aires on Sunday is Monday in UTC.
    const late = { id: "c", status: "published" as const, at: new Date("2026-09-28T02:30:00Z") };
    const week = buildWeek({
      monday: "2026-09-21",
      timeZone: BA,
      slots,
      posts: [early, late],
      now,
    });
    expect(week[4]?.entries.map((e) => [e.localTime, e.post?.id ?? null, e.slotId])).toEqual([
      ["10:30", "b", null],
      ["19:00", null, "fri"],
    ]);
    expect(week[6]?.entries.map((e) => [e.localTime, e.post?.id])).toEqual([["23:30", "c"]]);
  });

  it("only moves posts that are not published or archived", () => {
    expect(
      ["generating", "in_review", "approved", "scheduled"].every((s) => isMovable(s as never)),
    ).toBe(true);
    expect(
      ["publishing", "published", "archived", "failed"].some((s) => isMovable(s as never)),
    ).toBe(false);
  });
});
