import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

// Isolated workspace of a generation run (CLAUDE.md, rule 7; ADR 0005). claude -p runs with this
// folder as its cwd, so it loads the brand's CLAUDE.md written here and never the development one.
// The folder lives outside the repo and is removed when the run ends (kept when it failed, to
// look into it).

/** Default parent folder: `<system tmp>/radev-social/runs`. */
export const defaultWorkspaceRoot = () => join(tmpdir(), "radev-social", "runs");

/** Plain names only: no folders, no `..`, nothing hidden. */
const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

export function isSafeFileName(name: string): boolean {
  return SAFE_NAME.test(name) && !name.includes("..");
}

/**
 * What makes a folder a project for Claude Code: instructions and settings it reads from the
 * folders above the cwd, or a git repository (it takes the repo root as the project). `.git/HEAD`
 * and not `.git`: an empty `.git` folder (WSL had one in /tmp) is not a repository.
 */
const PROJECT_MARKERS = [
  "CLAUDE.md",
  "CLAUDE.local.md",
  ".claude",
  join(".git", "HEAD"),
  "pnpm-workspace.yaml",
];

/**
 * Throws when `dir` sits inside a project (the repo or any other): Claude Code would also read
 * the CLAUDE.md files of the folders above it.
 */
export function assertOutsideProjects(dir: string): void {
  let current = dirname(resolve(dir));
  while (true) {
    const marker = PROJECT_MARKERS.find((name) => existsSync(join(current, name)));
    if (marker) {
      throw new Error(
        `El workspace de generación no puede estar dentro de un proyecto (${join(current, marker)}).`,
      );
    }
    const parent = dirname(current);
    if (parent === current) return;
    current = parent;
  }
}

export type Workspace = {
  runId: string;
  dir: string;
  /** Removes the folder, unless `keep` (a failed run, to debug). */
  dispose(options?: { keep?: boolean }): Promise<void>;
};

export async function createWorkspace(
  files: Readonly<Record<string, string>>,
  options: { root?: string; runId?: string } = {},
): Promise<Workspace> {
  const bad = Object.keys(files).filter((name) => !isSafeFileName(name));
  if (bad.length > 0) throw new Error(`Nombres de archivo no permitidos: ${bad.join(", ")}`);

  const runId = options.runId ?? randomUUID();
  if (!isSafeFileName(runId)) throw new Error("Identificador de ejecución no permitido.");
  const root = resolve(options.root ?? defaultWorkspaceRoot());
  const dir = join(root, runId);
  assertOutsideProjects(dir);

  // Only the owner can read it: brand documents may hold private data (prices, cases).
  await mkdir(dir, { recursive: true, mode: 0o700 });
  try {
    for (const [name, content] of Object.entries(files)) {
      await writeFile(join(dir, name), content, { encoding: "utf8", mode: 0o600 });
    }
  } catch (error) {
    await rm(dir, { recursive: true, force: true });
    throw error;
  }

  return {
    runId,
    dir,
    async dispose({ keep = false } = {}) {
      if (!keep) await rm(dir, { recursive: true, force: true });
    },
  };
}

/**
 * Runs `fn` in a fresh workspace and cleans up after it. The folder is kept when `fn` throws
 * or when `keepIf` says so (e.g. a result with an error), to look into what the model saw.
 */
export async function withWorkspace<T>(
  files: Readonly<Record<string, string>>,
  fn: (workspace: Workspace) => Promise<T>,
  options: { root?: string; runId?: string; keepIf?: (result: T) => boolean } = {},
): Promise<T> {
  const workspace = await createWorkspace(files, options);
  let result: T;
  try {
    result = await fn(workspace);
  } catch (error) {
    await workspace.dispose({ keep: true });
    throw error;
  }
  await workspace.dispose({ keep: options.keepIf?.(result) ?? false });
  return result;
}
