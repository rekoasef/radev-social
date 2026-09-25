import { describe, expect, it } from "vitest";
import {
  DEFAULT_GENERATION_WINDOW,
  fillBudget,
  isWithinWindow,
  parseGenerationWindow,
  pillarsByNeed,
  planFill,
  researchDue,
} from "./fill";
import type { SlotOccurrence } from "./slots";

const BA = "America/Argentina/Buenos_Aires";
/** An instant at a local time of Buenos Aires (UTC-3) on 26/09/2026. */
const at = (hhmm: string) => new Date(`2026-09-26T${hhmm}:00-03:00`);

describe("generation window", () => {
  const window = { enabled: true, start: "02:00", end: "07:00", timeZone: BA };

  it("is off by default", () => {
    expect(parseGenerationWindow(undefined)).toEqual(DEFAULT_GENERATION_WINDOW);
    expect(DEFAULT_GENERATION_WINDOW.enabled).toBe(false);
    expect(isWithinWindow(at("03:00"), parseGenerationWindow(undefined))).toBe(false);
  });

  it("takes the start, not the end, in the window's zone", () => {
    expect(isWithinWindow(at("02:00"), window)).toBe(true);
    expect(isWithinWindow(at("06:59"), window)).toBe(true);
    expect(isWithinWindow(at("07:00"), window)).toBe(false);
    expect(isWithinWindow(at("01:59"), window)).toBe(false);
    expect(isWithinWindow(at("14:00"), window)).toBe(false);
  });

  it("crosses midnight", () => {
    const night = { ...window, start: "23:00", end: "05:00" };
    expect(isWithinWindow(at("23:30"), night)).toBe(true);
    expect(isWithinWindow(at("04:59"), night)).toBe(true);
    expect(isWithinWindow(at("12:00"), night)).toBe(false);
    expect(isWithinWindow(at("12:00"), { ...window, end: "02:00" })).toBe(false);
  });

  it("keeps the defaults for what is invalid", () => {
    expect(
      parseGenerationWindow({
        enabled: true,
        start: "25:00",
        end: "06:30",
        timeZone: "Marte/Olimpo",
      }),
    ).toEqual({ ...DEFAULT_GENERATION_WINDOW, enabled: true, end: "06:30" });
  });
});

describe("fillBudget", () => {
  it("counts what was generated and what is being generated", () => {
    expect(fillBudget({ daily: 5, monthly: 100 }, { today: 2, month: 10 }, 1)).toBe(2);
    expect(fillBudget({ daily: null, monthly: 12 }, { today: 2, month: 10 }, 1)).toBe(1);
    expect(fillBudget({ daily: 1, monthly: null }, { today: 3, month: 3 }, 0)).toBe(0);
    expect(fillBudget({ daily: null, monthly: null }, { today: 9, month: 99 }, 4)).toBe(
      Number.POSITIVE_INFINITY,
    );
  });
});

describe("pillarsByNeed", () => {
  const pillars = [
    { key: "habits", share: 0.5 },
    { key: "news", share: 0.3 },
    { key: "product", share: 0.2 },
    { key: "paused", share: 0 },
  ];

  it("puts first the pillar furthest below its share", () => {
    expect(pillarsByNeed(pillars, {})).toEqual(["habits", "news", "product"]);
    expect(pillarsByNeed(pillars, { habits: 5, news: 1, product: 1 })).toEqual([
      "news",
      "product",
      "habits",
    ]);
  });
});

describe("planFill", () => {
  const occurrence = (day: number): SlotOccurrence => ({
    slotId: "s",
    at: new Date(Date.UTC(2026, 8, day, 22)),
    localDate: `2026-09-${day}`,
    localTime: "19:00",
    weekday: 1,
  });
  const free = [27, 28, 29, 30].map(occurrence);
  const pillars = [
    { key: "habits", share: 0.5 },
    { key: "news", share: 0.5 },
  ];

  it("follows the mix, with the oldest idea of each pillar", () => {
    const plan = planFill({
      free,
      pillars,
      counts: { habits: 2 },
      ideas: [
        { id: "h1", pillarKey: "habits" },
        { id: "n1", pillarKey: "news" },
        { id: "h2", pillarKey: "habits" },
        { id: "n2", pillarKey: "news" },
      ],
      budget: 10,
    });
    expect(plan.assignments.map((a) => `${a.pillarKey}:${a.ideaId}`)).toEqual([
      "news:n1",
      "news:n2",
      "habits:h1",
      "habits:h2",
    ]);
    // The 4th slot is news' turn again, but its ideas ran out: habits fills it and news asks for more.
    expect(plan).toMatchObject({ needIdeasFor: "news", unfilled: 0 });
  });

  it("uses ideas without a pillar, and another pillar when the needed one has none", () => {
    const plan = planFill({
      free: free.slice(0, 3),
      pillars,
      counts: {},
      ideas: [
        { id: "n1", pillarKey: "news" },
        { id: "free", pillarKey: null },
      ],
      budget: 10,
    });
    // "habits" goes first (tie → key): it takes the idea without a pillar; then news; then nothing.
    expect(plan.assignments.map((a) => `${a.pillarKey}:${a.ideaId}`)).toEqual([
      "habits:free",
      "news:n1",
    ]);
    expect(plan).toMatchObject({ needIdeasFor: "habits", unfilled: 1 });
  });

  it("stops at the budget and asks for ideas when the bank is empty", () => {
    expect(
      planFill({ free, pillars, counts: {}, ideas: [{ id: "x", pillarKey: "news" }], budget: 0 }),
    ).toEqual({ assignments: [], needIdeasFor: null, unfilled: 4 });
    expect(planFill({ free, pillars, counts: {}, ideas: [], budget: 5 })).toEqual({
      assignments: [],
      needIdeasFor: "habits",
      unfilled: 4,
    });
  });
});

describe("researchDue", () => {
  const now = new Date("2026-09-26T06:00:00Z");
  const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);

  it("asks once a week, counting the ones that worked or are running", () => {
    expect(researchDue({ ok: null, any: null }, now)).toBe(true);
    expect(researchDue({ ok: daysAgo(3), any: daysAgo(3) }, now)).toBe(false);
    expect(researchDue({ ok: daysAgo(7.1), any: daysAgo(7.1) }, now)).toBe(true);
  });

  it("after a failure, waits a day before trying again", () => {
    expect(researchDue({ ok: daysAgo(10), any: daysAgo(0.5) }, now)).toBe(false);
    expect(researchDue({ ok: null, any: daysAgo(1.5) }, now)).toBe(true);
  });
});
