import { describe, expect, it } from "vitest";
import { checkAiQuota, rateLimitDelayMs, zonedPeriodStart } from "./limits";

describe("checkAiQuota", () => {
  it("passes without caps and under them", () => {
    expect(checkAiQuota({ daily: null, monthly: null }, { today: 99, month: 999 })).toEqual({
      ok: true,
    });
    expect(checkAiQuota({ daily: 3, monthly: 60 }, { today: 2, month: 10 })).toEqual({ ok: true });
  });

  it("stops at the daily cap first, then the monthly one", () => {
    expect(checkAiQuota({ daily: 3, monthly: 60 }, { today: 3, month: 60 })).toEqual({
      ok: false,
      period: "day",
      limit: 3,
    });
    expect(checkAiQuota({ daily: null, monthly: 60 }, { today: 0, month: 60 })).toEqual({
      ok: false,
      period: "month",
      limit: 60,
    });
  });

  it("treats a cap of 0 as paused", () => {
    expect(checkAiQuota({ daily: 0, monthly: null }, { today: 0, month: 0 }).ok).toBe(false);
  });
});

describe("zonedPeriodStart", () => {
  const ba = "America/Argentina/Buenos_Aires"; // UTC-3, no DST

  it("starts the day at local midnight, not UTC midnight", () => {
    // 01:30 UTC on the 25th is 22:30 of the 24th in Buenos Aires.
    const now = new Date("2026-09-25T01:30:00Z");
    expect(zonedPeriodStart(now, ba, "day").toISOString()).toBe("2026-09-24T03:00:00.000Z");
    expect(zonedPeriodStart(now, "UTC", "day").toISOString()).toBe("2026-09-25T00:00:00.000Z");
  });

  it("starts the month on the local first day", () => {
    const now = new Date("2026-10-01T02:00:00Z"); // still September 30 in Buenos Aires
    expect(zonedPeriodStart(now, ba, "month").toISOString()).toBe("2026-09-01T03:00:00.000Z");
  });

  it("uses the offset of the start itself across a DST change", () => {
    // Madrid moves from UTC+2 to UTC+1 on 2026-10-25; on the 26th the month began at UTC+2.
    const now = new Date("2026-10-26T12:00:00Z");
    expect(zonedPeriodStart(now, "Europe/Madrid", "month").toISOString()).toBe(
      "2026-09-30T22:00:00.000Z",
    );
    expect(zonedPeriodStart(now, "Europe/Madrid", "day").toISOString()).toBe(
      "2026-10-25T23:00:00.000Z",
    );
  });
});

describe("rateLimitDelayMs", () => {
  it("backs off 15, 30, 60, 120 and then 240 minutes", () => {
    const minutes = [0, 1, 2, 3, 4, 9].map((attempt) => rateLimitDelayMs(attempt, null) / 60_000);
    expect(minutes).toEqual([15, 30, 60, 120, 240, 240]);
  });

  it("waits until the provider's reset when it is later", () => {
    expect(rateLimitDelayMs(0, 3 * 3_600_000)).toBe(3 * 3_600_000);
    expect(rateLimitDelayMs(0, 60_000)).toBe(15 * 60_000);
  });
});
