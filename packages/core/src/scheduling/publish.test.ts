import { describe, expect, it } from "vitest";
import {
  checkScheduleTime,
  freeOccurrences,
  isPublishJobCurrent,
  MAX_SCHEDULE_DAYS,
  plannedTimeOnApprove,
} from "./publish";
import type { SlotOccurrence } from "./slots";

const now = new Date("2026-09-25T21:00:00Z");
const minutes = (n: number) => new Date(now.getTime() + n * 60_000);

describe("checkScheduleTime", () => {
  it("accepts a time ahead, within the limit", () => {
    expect(checkScheduleTime(minutes(5), now)).toEqual({ ok: true });
    expect(checkScheduleTime(minutes(60 * 24 * (MAX_SCHEDULE_DAYS - 1)), now).ok).toBe(true);
  });

  it("refuses the past, right now, too far ahead and invalid dates", () => {
    for (const at of [
      minutes(-10),
      minutes(0),
      minutes(60 * 24 * (MAX_SCHEDULE_DAYS + 1)),
      new Date("x"),
    ]) {
      expect(checkScheduleTime(at, now).ok).toBe(false);
    }
  });
});

describe("freeOccurrences", () => {
  const occurrence = (iso: string): SlotOccurrence => ({
    slotId: "s",
    at: new Date(iso),
    localDate: iso.slice(0, 10),
    localTime: "19:00",
    weekday: 1,
  });

  it("leaves out the times that already have a post", () => {
    const all = [occurrence("2026-09-26T22:00:00Z"), occurrence("2026-09-27T22:00:00Z")];
    const free = freeOccurrences(all, [new Date("2026-09-26T22:00:00.000Z")]);
    expect(free.map((o) => o.at.toISOString())).toEqual(["2026-09-27T22:00:00.000Z"]);
  });
});

describe("plannedTimeOnApprove", () => {
  it("schedules a post whose planned time is still ahead", () => {
    expect(plannedTimeOnApprove(minutes(120), now)).toEqual({ schedule: true, at: minutes(120) });
  });

  it("forgets a planned time that passed; nothing to do without one", () => {
    expect(plannedTimeOnApprove(minutes(-30), now)).toEqual({ schedule: false, clear: true });
    expect(plannedTimeOnApprove(null, now)).toEqual({ schedule: false, clear: false });
  });
});

describe("isPublishJobCurrent", () => {
  const at = new Date("2026-09-26T22:00:00Z");
  const job = { postId: "p", scheduledAt: at.toISOString() };

  it("stands for a post scheduled at the job's time", () => {
    expect(isPublishJobCurrent({ status: "scheduled", scheduledAt: at }, job)).toBe(true);
  });

  it("is stale if the post moved, was unscheduled or is not scheduled anymore (rule 3)", () => {
    expect(isPublishJobCurrent({ status: "scheduled", scheduledAt: minutes(999) }, job)).toBe(
      false,
    );
    expect(isPublishJobCurrent({ status: "scheduled", scheduledAt: null }, job)).toBe(false);
    for (const status of ["approved", "rendering", "in_review", "publishing", "published"]) {
      expect(isPublishJobCurrent({ status, scheduledAt: at }, job)).toBe(false);
    }
  });
});
