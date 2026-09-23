import dynamicIconImports from "lucide-react/dynamicIconImports";
import { describe, expect, it } from "vitest";
import iconNames from "./icon-names.json" with { type: "json" };

describe("icon-names.json", () => {
  it("matches the installed lucide-react (pnpm --filter @radev/slides icons:sync)", () => {
    expect(iconNames).toEqual(Object.keys(dynamicIconImports).sort());
  });
});
