import { describe, expect, it } from "vitest";
import iconNames from "./content/icon-names.json" with { type: "json" };
import { iconComponent } from "./icons";

describe("iconComponent", () => {
  it("resolves every valid icon name, aliases included", () => {
    const missing = iconNames.filter((name) => !iconComponent(name));
    expect(missing).toEqual([]);
  });

  it("returns undefined for unknown names", () => {
    expect(iconComponent("not-an-icon")).toBeUndefined();
  });
});
