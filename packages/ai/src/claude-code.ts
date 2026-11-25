import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { z } from "zod";
import { type AIError, providerError, rateLimited } from "./errors";
import { inlineTask } from "./inline";
import { parseJsonText, parseOutput, toJsonSchema } from "./schema";
import type { AIProvider, GenerationResult, GenerationTask, Usage } from "./types";
import { withWorkspace } from "./workspace";

// claude-code provider: Claude Code headless (`claude -p`) with the operator's subscription
// (docs/ARCHITECTURE.md §7, ADR 0005). Each run happens in its own workspace outside the repo
// (rule 7), with an environment that carries only what the CLI needs: never the worker's secrets.
// The brand's instructions replace Claude Code's own system prompt and the context goes inside
// the prompt, without tools (unless the task asks for some): Claude Code's prompt and tool
// definitions weighed ~27k tokens, resent on every turn, far more than the carousel itself.

/** Two turns: the answer comes through the structured-output tool, which takes one of its own. */
export const DEFAULT_MAX_TURNS = 3;
export const DEFAULT_TIMEOUT_MS = 5 * 60_000;
/** Time between SIGTERM and SIGKILL when a run has to be stopped. */
const KILL_GRACE_MS = 5_000;
/** Cap of what is kept from stdout and stderr (the envelope is a few KB). */
const MAX_OUTPUT_BYTES = 10 * 1024 * 1024;

/** The two ways to authenticate. Only one may be defined at a time (CLAUDE.md, rule 10). */
export const CLAUDE_CREDENTIAL_VARS = ["CLAUDE_CODE_OAUTH_TOKEN", "ANTHROPIC_API_KEY"] as const;
export type ClaudeCredential = { name: (typeof CLAUDE_CREDENTIAL_VARS)[number]; value: string };

/** The credential in `env`, null when there is none. Throws when both are defined. */
export function claudeCredential(env: NodeJS.ProcessEnv): ClaudeCredential | null {
  const defined = CLAUDE_CREDENTIAL_VARS.filter((name) => env[name]?.trim());
  if (defined.length > 1) {
    throw new Error(
      "CLAUDE_CODE_OAUTH_TOKEN y ANTHROPIC_API_KEY están definidas a la vez. Dejá solo una en el .env.",
    );
  }
  const [name] = defined;
  return name ? { name, value: env[name]?.trim() ?? "" } : null;
}

/** Variables passed through to the CLI when present (locale and proxies). Nothing else leaks. */
const PASS_THROUGH = [
  "PATH",
  "LANG",
  "LC_ALL",
  "TZ",
  "HTTPS_PROXY",
  "HTTP_PROXY",
  "NO_PROXY",
] as const;

/**
 * Environment of a run. HOME points to a folder of our own so the CLI doesn't read the
 * operator's ~/.claude (personal CLAUDE.md, skills, plugins) in development.
 */
export function claudeEnv(
  credential: ClaudeCredential,
  home: string,
  source: NodeJS.ProcessEnv,
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const name of PASS_THROUGH) if (source[name]) env[name] = source[name];
  return {
    ...env,
    HOME: home,
    CLAUDE_CONFIG_DIR: join(home, ".claude"),
    TMPDIR: tmpdir(),
    // The version is pinned in package.json; no updates, telemetry or error reports.
    DISABLE_AUTOUPDATER: "1",
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
    [credential.name]: credential.value,
  };
}

/** Default HOME of the CLI: `<system tmp>/radev-social/claude-home`, next to the workspaces. */
export const defaultClaudeHome = () => join(tmpdir(), "radev-social", "claude-home");

/**
 * Native binary of the pinned @anthropic-ai/claude-code: its install script copies the one of
 * this platform (linux x64/arm64, macOS, Windows) over `bin/claude.exe`.
 */
export function resolveClaudeBin(): string {
  const require = createRequire(import.meta.url);
  return join(
    dirname(require.resolve("@anthropic-ai/claude-code/package.json")),
    "bin",
    "claude.exe",
  );
}

/** Workspace files of a run: the system prompt and the prompt, also kept to debug a failed run. */
export const SYSTEM_PROMPT_FILE = "system-prompt.md";
export const PROMPT_FILE = "prompt.md";

/**
 * The workspace of a run. Never a `CLAUDE.md`: Claude Code would load it on top of the system
 * prompt. The prompt also goes through stdin (an argument is capped at 128 KB on Linux).
 */
export function buildClaudeFiles(task: GenerationTask<unknown>): Record<string, string> {
  const { system, user } = inlineTask(task);
  return { ...(system && { [SYSTEM_PROMPT_FILE]: system }), [PROMPT_FILE]: user };
}

/**
 * Arguments of `claude -p` (phase 3 T0; lean mode verified with 2.1.282). Passed as a list: no
 * shell involved. The prompt comes through stdin.
 */
export function buildClaudeArgs(task: GenerationTask<unknown>): string[] {
  const tools = task.tools ?? [];
  const system = inlineTask(task).system !== null;
  return [
    "-p",
    // With images the message goes as a JSON line (ADR 0024); the answer then comes as events.
    ...(streams(task)
      ? ["--input-format", "stream-json", "--output-format", "stream-json", "--verbose"]
      : ["--output-format", "json"]),
    "--json-schema",
    JSON.stringify(toJsonSchema(task.schema)),
    "--max-turns",
    String(task.maxTurns ?? DEFAULT_MAX_TURNS),
    ...(system ? ["--system-prompt-file", SYSTEM_PROMPT_FILE] : []),
    // "" leaves the model without tools: everything it needs is in the prompt.
    "--tools",
    tools.join(","),
    ...(tools.length > 0 ? ["--allowedTools", tools.join(",")] : []),
    "--model",
    task.model,
    ...(task.effort ? ["--effort", task.effort] : []),
    "--no-session-persistence",
    "--setting-sources",
    "project",
    "--strict-mcp-config",
  ];
}

/** Whether a run sends images, and so speaks `stream-json` both ways. */
const streams = (task: GenerationTask<unknown>) => (task.images?.length ?? 0) > 0;

/**
 * What goes through stdin: the prompt as is, or, with images, one user message in `stream-json`
 * with each image after a line that names it (the prompt refers to them by id) and the prompt last.
 */
export function buildClaudeInput(task: GenerationTask<unknown>, prompt: string): string {
  if (!streams(task)) return prompt;
  const content = [
    ...(task.images ?? []).flatMap((image) => [
      { type: "text", text: `Captura \`${image.id}\`: ${image.note}` },
      {
        type: "image",
        source: {
          type: "base64",
          media_type: image.mime,
          data: Buffer.from(image.data).toString("base64"),
        },
      },
    ]),
    { type: "text", text: prompt },
  ];
  return `${JSON.stringify({ type: "user", message: { role: "user", content } })}\n`;
}

/** The final envelope in the CLI's output: the whole stdout, or the `result` event of a stream. */
function envelopeJson(stdout: string, streaming: boolean): unknown {
  if (!streaming) return JSON.parse(stdout);
  for (const line of stdout.trim().split("\n").reverse()) {
    try {
      const event = JSON.parse(line) as { type?: unknown };
      if (event.type === "result") return event;
    } catch {
      // A line cut by the output cap, or not JSON: keep looking.
    }
  }
  throw new Error("Sin evento result.");
}

/** The JSON envelope `claude -p --output-format json` prints. Only the fields we use. */
const envelopeSchema = z.object({
  is_error: z.boolean(),
  result: z.string().nullish(),
  structured_output: z.unknown().optional(),
  session_id: z.string().nullish(),
  num_turns: z.number().nullish(),
  duration_ms: z.number().nullish(),
  total_cost_usd: z.number().nullish(),
  terminal_reason: z.string().nullish(),
  api_error_status: z.number().nullish(),
  usage: z
    .object({
      input_tokens: z.number().nullish(),
      output_tokens: z.number().nullish(),
      cache_creation_input_tokens: z.number().nullish(),
      cache_read_input_tokens: z.number().nullish(),
    })
    .nullish(),
  modelUsage: z.record(z.string(), z.object({ outputTokens: z.number().nullish() })).nullish(),
});
export type ClaudeEnvelope = z.infer<typeof envelopeSchema>;

export function envelopeUsage(
  envelope: ClaudeEnvelope,
  requestedModel: string,
  elapsedMs: number,
): Usage {
  const usage = envelope.usage ?? {};
  // The model that wrote the most is the one that answered (a run can also use a small one).
  const models = Object.entries(envelope.modelUsage ?? {}).sort(
    ([, a], [, b]) => (b.outputTokens ?? 0) - (a.outputTokens ?? 0),
  );
  return {
    provider: "claude-code",
    model: models[0]?.[0] ?? requestedModel,
    inputTokens:
      (usage.input_tokens ?? 0) +
      (usage.cache_creation_input_tokens ?? 0) +
      (usage.cache_read_input_tokens ?? 0),
    outputTokens: usage.output_tokens ?? 0,
    costUsd: envelope.total_cost_usd ?? null,
    durationMs: envelope.duration_ms ?? elapsedMs,
    numTurns: envelope.num_turns ?? null,
    sessionId: envelope.session_id ?? null,
  };
}

/**
 * The subscription's usage limit. Expected as HTTP 429 (not verified: T0 couldn't trigger it);
 * the CLI has also reported it as text, "Claude AI usage limit reached|<unix seconds>".
 */
const USAGE_LIMIT_TEXT = /usage limit reached(?:\|(\d{9,11}))?/i;

/**
 * Error of an envelope with `is_error`. By `api_error_status` and `terminal_reason`, never by
 * `subtype` (it says "success" on API errors; ARCHITECTURE §7).
 */
export function classifyEnvelopeError(envelope: ClaudeEnvelope, now = Date.now()): AIError {
  const status = envelope.api_error_status ?? null;
  const detail = envelope.result?.trim().slice(0, 300) || "sin detalle";
  const limitText = envelope.result?.match(USAGE_LIMIT_TEXT);
  if (status === 429 || limitText) {
    const resetAt = limitText?.[1] ? Number(limitText[1]) * 1000 : null;
    return rateLimited(
      `Claude Code llegó al límite de uso de la suscripción: ${detail}`,
      resetAt !== null && resetAt > now ? resetAt - now : null,
    );
  }
  if (envelope.terminal_reason === "max_turns") {
    return providerError(
      "Claude Code usó todos los turnos permitidos sin terminar la respuesta.",
      true,
    );
  }
  if (status === 401 || status === 403) {
    return providerError(
      `Claude Code rechazó la credencial (HTTP ${status}). Revisá CLAUDE_CODE_OAUTH_TOKEN: ${detail}`,
      false,
    );
  }
  if (status !== null && status >= 400 && status < 500) {
    // 400 or 404: a wrong request or model name. Asking again won't fix it.
    return providerError(`Claude Code devolvió HTTP ${status}: ${detail}`, false);
  }
  const reason = status !== null ? `HTTP ${status}` : (envelope.terminal_reason ?? "error");
  return providerError(`Claude Code falló (${reason}): ${detail}`, true);
}

/** The data of a successful envelope: `structured_output`, or JSON inside the text as a fallback. */
export function parseEnvelopeOutput<T>(
  schema: z.ZodType<T>,
  envelope: ClaudeEnvelope,
): { ok: true; data: T } | { ok: false; error: AIError } {
  if (envelope.structured_output !== undefined && envelope.structured_output !== null) {
    return parseOutput(schema, envelope.structured_output);
  }
  return parseJsonText(schema, envelope.result ?? "");
}

type ProcessResult = {
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  aborted: boolean;
  spawnError: NodeJS.ErrnoException | null;
};

function runProcess(
  bin: string,
  args: string[],
  options: {
    cwd: string;
    env: NodeJS.ProcessEnv;
    input: string;
    timeoutMs: number;
    signal?: AbortSignal;
  },
): Promise<ProcessResult> {
  return new Promise((resolve) => {
    const result: ProcessResult = {
      code: null,
      stdout: "",
      stderr: "",
      timedOut: false,
      aborted: false,
      spawnError: null,
    };
    if (options.signal?.aborted) {
      resolve({ ...result, aborted: true });
      return;
    }
    const child = spawn(bin, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    // A CLI that exits without reading stdin would fail the write: the exit code tells the rest.
    child.stdin.on("error", () => {});
    child.stdin.end(options.input);

    const collect = (key: "stdout" | "stderr") => (chunk: Buffer) => {
      if (result[key].length < MAX_OUTPUT_BYTES) result[key] += chunk.toString("utf8");
    };
    child.stdout.on("data", collect("stdout"));
    child.stderr.on("data", collect("stderr"));

    let killTimer: NodeJS.Timeout | undefined;
    const stop = () => {
      child.kill("SIGTERM");
      killTimer = setTimeout(() => child.kill("SIGKILL"), KILL_GRACE_MS);
    };
    const timer = setTimeout(() => {
      result.timedOut = true;
      stop();
    }, options.timeoutMs);
    const onAbort = () => {
      result.aborted = true;
      stop();
    };
    options.signal?.addEventListener("abort", onAbort, { once: true });

    const finish = () => {
      clearTimeout(timer);
      clearTimeout(killTimer);
      options.signal?.removeEventListener("abort", onAbort);
      resolve(result);
    };
    child.on("error", (error: NodeJS.ErrnoException) => {
      result.spawnError = error;
      finish();
    });
    child.on("close", (code) => {
      result.code = code;
      finish();
    });
  });
}

/** Last lines of stderr for an error message (never the environment: it holds the token). */
const stderrTail = (stderr: string) =>
  stderr.trim().split("\n").slice(-5).join(" · ").slice(0, 300);

export type ClaudeCodeOptions = {
  /** Environment to read the credential and pass-through variables from. Default: process.env. */
  env?: NodeJS.ProcessEnv;
  /** CLI binary. Default: the pinned @anthropic-ai/claude-code. */
  bin?: string;
  /** HOME of the CLI. Default: `defaultClaudeHome()`. */
  home?: string;
  /** Parent folder of the workspaces. Default: `defaultWorkspaceRoot()`. */
  workspaceRoot?: string;
  /** Keep the workspace of failed runs to look into it (default true). */
  keepFailed?: boolean;
};

/**
 * Throws when both credentials are defined (a configuration error, found at startup). Without
 * any credential it builds anyway: each run fails with a non-retryable error that says so.
 */
export function createClaudeCodeProvider(options: ClaudeCodeOptions = {}): AIProvider {
  const source = options.env ?? process.env;
  const credential = claudeCredential(source);
  const home = options.home ?? defaultClaudeHome();
  const keepFailed = options.keepFailed ?? true;

  return {
    id: "claude-code",
    async generate<T>(task: GenerationTask<T>): Promise<GenerationResult<T>> {
      if (!credential) {
        return {
          ok: false,
          error: providerError(
            "Falta la credencial de Claude Code: definí CLAUDE_CODE_OAUTH_TOKEN en el .env (se genera con `claude setup-token`).",
            false,
          ),
          usage: null,
        };
      }
      mkdirSync(home, { recursive: true, mode: 0o700 });
      const bin = options.bin ?? resolveClaudeBin();
      const args = buildClaudeArgs(task as GenerationTask<unknown>);
      const env = claudeEnv(credential, home, source);
      const timeoutMs = task.timeoutMs ?? DEFAULT_TIMEOUT_MS;

      const files = buildClaudeFiles(task as GenerationTask<unknown>);
      return withWorkspace(
        files,
        async (workspace): Promise<GenerationResult<T>> => {
          const startedAt = Date.now();
          const run = await runProcess(bin, args, {
            cwd: workspace.dir,
            env,
            input: buildClaudeInput(task as GenerationTask<unknown>, files[PROMPT_FILE] ?? ""),
            timeoutMs,
            signal: task.signal,
          });
          const elapsedMs = Date.now() - startedAt;

          if (run.spawnError) {
            return {
              ok: false,
              error: providerError(
                `No se pudo ejecutar Claude Code (${run.spawnError.code ?? run.spawnError.message}).`,
                false,
              ),
              usage: null,
            };
          }
          if (run.aborted) {
            return {
              ok: false,
              error: providerError("La generación se canceló.", true),
              usage: null,
            };
          }
          if (run.timedOut) {
            return {
              ok: false,
              error: providerError(
                `Claude Code no respondió en ${Math.round(timeoutMs / 1000)} s y se cortó.`,
                true,
              ),
              usage: null,
            };
          }

          let envelope: ClaudeEnvelope;
          try {
            envelope = envelopeSchema.parse(
              envelopeJson(run.stdout, streams(task as GenerationTask<unknown>)),
            );
          } catch {
            const tail = stderrTail(run.stderr);
            return {
              ok: false,
              error: providerError(
                `Claude Code terminó (código ${run.code}) sin una respuesta legible${tail ? `: ${tail}` : "."}`,
                true,
              ),
              usage: null,
            };
          }

          const usage = envelopeUsage(envelope, task.model, elapsedMs);
          if (envelope.is_error) {
            return { ok: false, error: classifyEnvelopeError(envelope), usage };
          }
          const parsed = parseEnvelopeOutput(task.schema, envelope);
          return parsed.ok
            ? { ok: true, data: parsed.data, usage }
            : { ok: false, error: parsed.error, usage };
        },
        { root: options.workspaceRoot, keepIf: (result) => keepFailed && !result.ok },
      );
    },
  };
}
