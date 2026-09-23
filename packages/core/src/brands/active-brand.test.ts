import { describe, expect, it } from "vitest";
import { pickActiveBrand } from "./active-brand";

const radev = { slug: "radev", archivedAt: null };
const lumus = { slug: "lumus", archivedAt: null };
const old = { slug: "old", archivedAt: new Date("2026-01-01T00:00:00Z") };

describe("pickActiveBrand", () => {
  it("returns the preferred brand when it is active", () => {
    expect(pickActiveBrand([radev, lumus], "lumus")).toBe(lumus);
  });

  it("falls back to the first active brand without a preference", () => {
    expect(pickActiveBrand([radev, lumus], undefined)).toBe(radev);
  });

  it("falls back when the preferred brand no longer exists", () => {
    expect(pickActiveBrand([radev, lumus], "deleted")).toBe(radev);
  });

  it("never picks an archived brand", () => {
    expect(pickActiveBrand([old, lumus], "old")).toBe(lumus);
  });

  it("returns undefined when every brand is archived", () => {
    expect(pickActiveBrand([old], "old")).toBeUndefined();
  });
});
