import { beforeEach, describe, expect, it, vi } from "vitest";
import { createLogger } from "../logger";
import { fillSlots } from "./slots-fill";

const db = vi.hoisted(() => ({
  window: undefined as unknown,
  planned: [] as Date[],
  created: [] as { request: unknown; plan: unknown; ideaId: unknown }[],
  requests: [] as unknown[],
  saved: {} as Record<string, unknown>,
}));

vi.mock("@radev/db", () => ({
  getSetting: async () => db.window,
  setSetting: async (_: unknown, key: string, value: unknown) => {
    db.saved[key] = value;
  },
  listBrands: async () => [
    {
      id: "b1",
      slug: "lumus",
      timezone: "America/Argentina/Buenos_Aires",
      archivedAt: null,
      aiDailyLimit: null,
      aiMonthlyLimit: null,
    },
  ],
  // Every day at 19:00.
  listScheduleSlots: async () =>
    [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
      id: `s${weekday}`,
      weekday,
      localTime: "19:00",
      active: true,
    })),
  listPlannedTimes: async () => db.planned,
  listPillars: async () => [
    { key: "habits", targetShare: 0.5 },
    { key: "news", targetShare: 0.5 },
  ],
  getBrandAiUsage: async () => ({ today: 0, month: 0 }),
  countGeneratingPosts: async () => 0,
  pillarPostCounts: async () => ({}),
  listBankIdeasForFill: async () => [
    {
      id: "i1",
      title: "Idea 1",
      angle: "",
      pillarKey: "habits",
      seriesKey: null,
      seriesHook: null,
    },
    {
      id: "i2",
      title: "Idea 2",
      angle: "Ángulo",
      pillarKey: "news",
      seriesKey: null,
      seriesHook: null,
    },
  ],
  createGeneratingPost: async (
    _: unknown,
    input: { request: unknown; plan: unknown; ideaId: unknown },
  ) => {
    db.created.push(input);
    return { id: `p${db.created.length}`, publicCode: `LU-000${db.created.length}` };
  },
  createIdeaRequest: async (_: unknown, input: unknown) => {
    db.requests.push(input);
    return { ok: true, request: { id: "r1" } };
  },
}));

const log = createLogger({}, "error");
// Saturday 26/09/2026, 03:00 in Buenos Aires.
const now = new Date("2026-09-26T06:00:00Z");
const window = {
  enabled: true,
  start: "02:00",
  end: "07:00",
  timeZone: "America/Argentina/Buenos_Aires",
};

describe("slots.fill", () => {
  const queueGenerate = vi.fn(async () => {});
  const queueIdeaRequest = vi.fn(async () => {});
  const run = () => fillSlots({ db: {} as never, log, queueGenerate, queueIdeaRequest, now });

  beforeEach(() => {
    Object.assign(db, { window, planned: [], created: [], requests: [], saved: {} });
    queueGenerate.mockClear();
    queueIdeaRequest.mockClear();
  });

  it("does nothing outside the window or with it off", async () => {
    db.window = { ...window, enabled: false };
    expect(await run()).toBe("outside-window");
    db.window = { ...window, start: "04:00" };
    expect(await run()).toBe("outside-window");
    expect(db.created).toEqual([]);
  });

  it("plans a post per free slot while there are ideas, then asks for more", async () => {
    // Today's 19:00 already has a post.
    db.planned = [new Date("2026-09-26T22:00:00Z")];
    const report = await run();
    expect(db.created.map((c) => [c.ideaId, c.plan])).toEqual([
      ["i1", { at: new Date("2026-09-27T22:00:00Z"), slotId: "s0" }],
      ["i2", { at: new Date("2026-09-28T22:00:00Z"), slotId: "s1" }],
    ]);
    expect(db.created[1]?.request).toEqual({
      idea: "Idea 2\n\nÁngulo",
      pillarKey: "news",
      hookType: null,
      seriesKey: null,
    });
    expect(queueGenerate).toHaveBeenCalledTimes(2);
    expect(db.requests).toEqual([
      {
        brandId: "b1",
        task: "ideas.generate",
        params: { count: 5, pillarKey: "habits", seriesKey: null, focus: null },
      },
    ]);
    expect(queueIdeaRequest).toHaveBeenCalledWith("r1");
    expect(report).toMatchObject({
      brands: [
        {
          slug: "lumus",
          created: ["LU-0001", "LU-0002"],
          requestedIdeasFor: "habits",
          unfilled: 4,
        },
      ],
    });
    expect(db.saved.slots_fill_last).toEqual(report);
  });
});
