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

// The same rule for videos (docs/RADEV-STUDIO-REVISION.md §7.2): only transitionVideo writes
// `videos.stage`.
const VIDEO_ALLOWED = "packages/db/src/queries/videos.ts";

describe("rule 2: videos.stage only changes through the state machine", () => {
  it("no code outside transitionVideo updates the videos table's stage", () => {
    const offenders = [...sources(join(root, "apps")), ...sources(join(root, "packages"))]
      .map((path) => ({ path: relative(root, path), text: readFileSync(path, "utf8") }))
      .filter(({ path }) => path !== VIDEO_ALLOWED)
      .filter(
        ({ text }) =>
          /\.update\(videos\)[\s\S]{0,300}?\bstage\s*:/.test(text) ||
          /update\s+"?videos"?\s+set[\s\S]{0,200}?"?stage"?\s*=/i.test(text),
      )
      .map(({ path }) => path);
    expect(offenders).toEqual([]);
  });

  it("inside queries/videos.ts, only transitionVideo sets the stage", () => {
    const text = readFileSync(join(root, VIDEO_ALLOWED), "utf8");
    const start = text.indexOf("export async function transitionVideo");
    const end = text.indexOf("// ───────────── condition");
    expect(start).toBeGreaterThan(0);
    // `stage` is assigned once, inside transitionVideo (the condition helpers never touch it)
    const assigns = text.match(/\bstage:\s*result\.to|\.set\(\{[^}]*\bstage\s*:/g) ?? [];
    expect(assigns).toHaveLength(1);
    expect(text.indexOf("stage: result.to")).toBeGreaterThan(start);
    expect(text.indexOf("stage: result.to")).toBeLessThan(end);
  });
});
