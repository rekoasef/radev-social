import { describe, expect, it } from "vitest";
import { startOfDay, startOfMonth } from "./video-time";

const zone = "America/Argentina/Buenos_Aires";

describe("studio day and month", () => {
  // 01:30 UTC on December 1st is still November 30th at 22:30 in Buenos Aires.
  const at = new Date("2026-12-01T01:30:00Z");

  it("start at the zone's midnight, not at UTC's", () => {
    expect(startOfDay(at, zone).toISOString()).toBe("2026-11-30T03:00:00.000Z");
    expect(startOfMonth(at, zone).toISOString()).toBe("2026-11-01T03:00:00.000Z");
  });
});
