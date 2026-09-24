import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  assertOutsideProjects,
  createWorkspace,
  defaultWorkspaceRoot,
  isSafeFileName,
  withWorkspace,
} from "./workspace";

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "radev-ws-test-"));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

const files = { "CLAUDE.md": "# Marca\n", "task.json": '{"idea":"x"}' };

describe("createWorkspace", () => {
  it("writes the files in a fresh folder, readable only by the owner", async () => {
    const ws = await createWorkspace(files, { root });
    expect(ws.dir.startsWith(root)).toBe(true);
    expect(readFileSync(join(ws.dir, "CLAUDE.md"), "utf8")).toBe("# Marca\n");
    expect(readFileSync(join(ws.dir, "task.json"), "utf8")).toBe('{"idea":"x"}');
    if (process.platform !== "win32") expect(statSync(ws.dir).mode & 0o777).toBe(0o700);
    await ws.dispose();
    expect(existsSync(ws.dir)).toBe(false);
  });

  it("keeps the folder when asked (a failed run)", async () => {
    const ws = await createWorkspace(files, { root });
    await ws.dispose({ keep: true });
    expect(existsSync(ws.dir)).toBe(true);
  });

  it("gives every run its own folder", async () => {
    const [a, b] = await Promise.all([
      createWorkspace(files, { root }),
      createWorkspace(files, { root }),
    ]);
    expect(a.dir).not.toBe(b.dir);
  });

  it("rejects file names that could leave the folder", async () => {
    for (const name of ["../CLAUDE.md", "sub/file.json", ".env", "", "a..b"]) {
      await expect(createWorkspace({ [name]: "x" }, { root })).rejects.toThrow(/no permitidos/);
    }
  });

  it("refuses to run inside the repo, where the development CLAUDE.md would load", async () => {
    const insideRepo = fileURLToPath(new URL(".", import.meta.url));
    await expect(createWorkspace(files, { root: insideRepo })).rejects.toThrow(
      /dentro de un proyecto/,
    );
  });
});

describe("assertOutsideProjects", () => {
  it("accepts the default root", () => {
    expect(() => assertOutsideProjects(join(defaultWorkspaceRoot(), "run"))).not.toThrow();
  });

  it("rejects a folder below a CLAUDE.md or a .claude folder", () => {
    mkdirSync(join(root, "a", ".claude"), { recursive: true });
    mkdirSync(join(root, "b"));
    writeFileSync(join(root, "b", "CLAUDE.md"), "# otro proyecto");
    expect(() => assertOutsideProjects(join(root, "a", "runs", "x"))).toThrow(/\.claude/);
    expect(() => assertOutsideProjects(join(root, "b", "runs", "x"))).toThrow(/CLAUDE\.md/);
  });

  it("ignores an empty .git folder, which is not a repository", () => {
    mkdirSync(join(root, "c", ".git"), { recursive: true });
    expect(() => assertOutsideProjects(join(root, "c", "runs", "x"))).not.toThrow();
    writeFileSync(join(root, "c", ".git", "HEAD"), "ref: refs/heads/main\n");
    expect(() => assertOutsideProjects(join(root, "c", "runs", "x"))).toThrow(/HEAD/);
  });
});

describe("isSafeFileName", () => {
  it("accepts the context file names", () => {
    for (const name of [
      "CLAUDE.md",
      "task.json",
      "recent-posts.json",
      "winners.json",
      "data.json",
    ]) {
      expect(isSafeFileName(name)).toBe(true);
    }
  });
});

describe("withWorkspace", () => {
  it("removes the folder after a successful run", async () => {
    let dir = "";
    const result = await withWorkspace(
      files,
      async (ws) => {
        dir = ws.dir;
        return "ok";
      },
      { root },
    );
    expect(result).toBe("ok");
    expect(existsSync(dir)).toBe(false);
  });

  it("keeps it when the run throws, and rethrows", async () => {
    let dir = "";
    await expect(
      withWorkspace(
        files,
        async (ws) => {
          dir = ws.dir;
          throw new Error("falló");
        },
        { root },
      ),
    ).rejects.toThrow("falló");
    expect(existsSync(dir)).toBe(true);
  });

  it("keeps it when the result says so", async () => {
    let dir = "";
    await withWorkspace(
      files,
      async (ws) => {
        dir = ws.dir;
        return { ok: false };
      },
      { root, keepIf: (r) => !r.ok },
    );
    expect(existsSync(dir)).toBe(true);
  });
});
