import { describe, expect, it } from "vitest";
import { SAMPLE_SCREENS, screenComposition, screenDevice, toggleScreen } from "./screens";

describe("screenDevice", () => {
  it("puts portrait screenshots in a phone and the rest in a laptop", () => {
    expect(screenDevice({ width: 738, height: 1600 })).toBe("phone");
    expect(screenDevice({ width: 1215, height: 908 })).toBe("laptop");
    expect(screenDevice({ width: 1000, height: 1100 })).toBe("laptop");
    expect(screenDevice({ width: null, height: null })).toBe("phone");
  });
});

describe("screenComposition", () => {
  const phone = { url: "p", width: 738, height: 1600 };
  const laptop = { url: "l", width: 1440, height: 900 };
  const assets = { p: phone, l: laptop, p2: { ...phone, url: "p2" } };

  it("draws one device, or both when there is one of each, whatever the order", () => {
    expect(screenComposition(["p"], assets)).toEqual({ kind: "phone", phone });
    expect(screenComposition(["l"], assets)).toEqual({ kind: "laptop", laptop });
    expect(screenComposition(["p", "l"], assets)).toEqual({ kind: "both", laptop, phone });
    expect(screenComposition(["l", "p"], assets)).toEqual({ kind: "both", laptop, phone });
  });

  it("shows the first of two of the same device, and a sample for a missing one", () => {
    expect(screenComposition(["p2", "p"], assets)).toMatchObject({ kind: "phone" });
    expect(screenComposition(["gone"], assets)).toMatchObject({ kind: "phone" });
    expect(screenComposition([SAMPLE_SCREENS.laptop], {})).toMatchObject({ kind: "laptop" });
  });
});

describe("toggleScreen", () => {
  const devices: Record<string, "phone" | "laptop"> = { p1: "phone", p2: "phone", l1: "laptop" };
  const deviceOf = (id: string) => devices[id] ?? "phone";

  it("joins a screenshot of the other device and replaces one of the same", () => {
    expect(toggleScreen(["p1"], "l1", deviceOf)).toEqual(["p1", "l1"]);
    expect(toggleScreen(["p1"], "p2", deviceOf)).toEqual(["p2"]);
    expect(toggleScreen(["p1", "l1"], "p2", deviceOf)).toEqual(["l1", "p2"]);
  });

  it("takes a chosen one out, but never the last", () => {
    expect(toggleScreen(["p1", "l1"], "p1", deviceOf)).toEqual(["l1"]);
    expect(toggleScreen(["p1"], "p1", deviceOf)).toEqual(["p1"]);
    expect(toggleScreen([], "p1", deviceOf)).toEqual(["p1"]);
  });
});
