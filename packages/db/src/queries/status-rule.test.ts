import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// CLAUDE.md, rule 2: a post's status only changes through the state machine. In code, that
// means only transitionPost (queries/posts.ts) may write `posts.status`.

const root = fileURLToPath(new URL("../../../../", import.meta.url));
const ALLOWED = "packages/db/src/queries/posts.ts";

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (["node_modules", ".next", ".turbo", "migrations", "dist"].includes(name)) return [];
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe("rule 2: posts.status only changes through the state machine", () => {
  it("no code outside transitionPost updates the posts table's status", () => {
    const offenders = [...sources(join(root, "apps")), ...sources(join(root, "packages"))]
      .map((path) => ({ path: relative(root, path), text: readFileSync(path, "utf8") }))
      .filter(({ path }) => path !== ALLOWED)
      .filter(
        ({ text }) =>
          /\.update\(posts\)[\s\S]{0,300}?\bstatus\s*:/.test(text) ||
          /update\s+"?posts"?\s+set[\s\S]{0,200}?"?status"?\s*=/i.test(text),
      )
      .map(({ path }) => path);
    expect(offenders).toEqual([]);
  });

  it("inside queries/posts.ts, only transitionPost sets the status", () => {
    const text = readFileSync(join(root, ALLOWED), "utf8");
    const sets = text.match(/\.set\(\{[^}]*\bstatus\s*:/g) ?? [];
    expect(sets).toHaveLength(1);
    const inTransition = text.slice(text.indexOf("export async function transitionPost"));
    expect(inTransition.indexOf(".set({ status: result.to })")).toBeGreaterThan(0);
  });
});
