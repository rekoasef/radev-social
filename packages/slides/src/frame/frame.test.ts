import { describe, expect, it } from "vitest";
import { FORMAT, isInSafeZone, SAFE_AREA } from "./geometry";
import { createRandom } from "./random";

describe("safe zones", () => {
  it("covers the 4:5 format minus the margins", () => {
    expect(FORMAT).toEqual({ id: "4x5", width: 1080, height: 1350 });
    expect(SAFE_AREA).toEqual({ x: 80, y: 80, width: 920, height: 1170 });
  });

  it("accepts content inside the margins and away from TikTok's buttons", () => {
    expect(isInSafeZone({ x: 80, y: 80, width: 920, height: 560 })).toBe(true);
    expect(isInSafeZone({ x: 80, y: 700, width: 850, height: 400 })).toBe(true);
  });

  it("rejects content outside the margins", () => {
    expect(isInSafeZone({ x: 60, y: 200, width: 400, height: 100 })).toBe(false);
    expect(isInSafeZone({ x: 80, y: 1200, width: 400, height: 100 })).toBe(false);
  });

  it("rejects content under TikTok's button column", () => {
    expect(isInSafeZone({ x: 80, y: 700, width: 900, height: 100 })).toBe(false);
    // Same width, but above the column: allowed.
    expect(isInSafeZone({ x: 80, y: 500, width: 900, height: 100 })).toBe(true);
  });
});

describe("createRandom", () => {
  it("is deterministic per seed", () => {
    const a = createRandom("post-1");
    const b = createRandom("post-1");
    const seqA = Array.from({ length: 5 }, () => a.next());
    expect(Array.from({ length: 5 }, () => b.next())).toEqual(seqA);
    const c = createRandom("post-2");
    expect(Array.from({ length: 5 }, () => c.next())).not.toEqual(seqA);
  });

  it("stays within bounds", () => {
    const random = createRandom("bounds");
    for (let i = 0; i < 500; i++) {
      const n = random.int(2, 4);
      expect(n).toBeGreaterThanOrEqual(2);
      expect(n).toBeLessThanOrEqual(4);
      expect(["a", "b"]).toContain(random.pick(["a", "b"]));
    }
  });
});
