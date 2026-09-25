import { describe, expect, it } from "vitest";
import {
  canDeletePillar,
  canRemovePillar,
  checkPillarMix,
  percentToShare,
  shareToPercent,
} from "./pillars";

describe("shares and percentages", () => {
  it.each([
    [0.35, 35],
    [0.1, 10],
    [0, 0],
    [1, 100],
    [0.15000000596, 15],
  ])("share %d → %d %", (share, percent) => {
    expect(shareToPercent(share)).toBe(percent);
  });

  it("round-trips", () => {
    for (let percent = 0; percent <= 100; percent++) {
      expect(shareToPercent(percentToShare(percent))).toBe(percent);
    }
  });
});

describe("checkPillarMix", () => {
  it("accepts whole percentages that add up to 100", () => {
    expect(checkPillarMix([40, 20, 15, 15, 10])).toEqual({ ok: true });
    expect(checkPillarMix([100])).toEqual({ ok: true });
    expect(checkPillarMix([100, 0])).toEqual({ ok: true });
  });

  it("rejects a total other than 100 and says the total", () => {
    const under = checkPillarMix([40, 20, 15]);
    expect(under.ok).toBe(false);
    if (!under.ok) expect(under.reason).toContain("75 %");
    expect(checkPillarMix([60, 50]).ok).toBe(false);
  });

  it("rejects fractions, negatives and values over 100", () => {
    expect(checkPillarMix([50.5, 49.5]).ok).toBe(false);
    expect(checkPillarMix([110, -10]).ok).toBe(false);
    expect(checkPillarMix([Number.NaN, 100]).ok).toBe(false);
  });

  it("needs at least one pillar", () => {
    expect(checkPillarMix([]).ok).toBe(false);
  });
});

describe("removing a pillar", () => {
  it("only at 0 %, so the others keep adding up to 100", () => {
    expect(canRemovePillar(0)).toEqual({ ok: true });
    expect(canRemovePillar(0.001)).toEqual({ ok: true });
    expect(canRemovePillar(0.1).ok).toBe(false);
  });

  it("deleting only without posts; with posts it is archived", () => {
    expect(canDeletePillar(0)).toEqual({ ok: true });
    expect(canDeletePillar(3).ok).toBe(false);
  });
});
