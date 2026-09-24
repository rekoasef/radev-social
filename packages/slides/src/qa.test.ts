import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { EXCLUSION_ZONES, FORMAT, SAFE_MARGINS } from "./frame/geometry";

describe("checkRender", () => {
  it("uses the same geometry as frame/geometry.ts", () => {
    // checkRender inlines its numbers so Playwright can send it to the page: keep them equal.
    const source = readFileSync(new URL("./qa.ts", import.meta.url), "utf8");
    expect(source).toContain(`const WIDTH = ${FORMAT.width};`);
    expect(source).toContain(
      `const SAFE = { left: ${SAFE_MARGINS.left}, top: ${SAFE_MARGINS.top}, right: ${FORMAT.width} - ${SAFE_MARGINS.right}, bottom: ${FORMAT.height} - ${SAFE_MARGINS.bottom} };`,
    );
    const zone = EXCLUSION_ZONES[0];
    expect(EXCLUSION_ZONES).toHaveLength(1);
    expect(source).toContain(`const TIKTOK = { left: ${zone?.x}, top: ${zone?.y} };`);
  });
});
