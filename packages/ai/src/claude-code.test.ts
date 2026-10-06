import { chmodSync, existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import {
  buildClaudeArgs,
  buildClaudeFiles,
  classifyEnvelopeError,
  claudeCredential,
  createClaudeCodeProvider,
  resolveClaudeBin,
} from "./claude-code";
import type { GenerationResult, GenerationTask } from "./types";

// A fake `claude` (a Node script) that answers by the prompt, like the real CLI would print
// with --output-format json. It checks the provider end to end: process, env, workspace, parsing.
const FAKE_CLI = `#!/usr/bin/env node
const { readdirSync, readFileSync } = require("node:fs");
const args = process.argv.slice(2);
// The prompt comes through stdin; its first line is the task's prompt (the files follow). With
// images it is one stream-json message whose last block is the prompt, and the answer is events.
const input = readFileSync(0, "utf8");
const streaming = args.includes("--input-format");
const message = streaming ? JSON.parse(input.split("\\n")[0]).message : null;
const text = streaming ? message.content[message.content.length - 1].text : input;
const prompt = text.split("\\n")[0];
const base = {
  is_error: false, session_id: "s-1", num_turns: 2, duration_ms: 1234, total_cost_usd: 0.01,
  terminal_reason: "completed", api_error_status: null,
  usage: { input_tokens: 10, output_tokens: 20, cache_creation_input_tokens: 5, cache_read_input_tokens: 5 },
  modelUsage: { "claude-haiku": { outputTokens: 1 }, "claude-sonnet-x": { outputTokens: 19 } },
};
const out = (envelope, code = 0) => {
  // In a stream, \`type\` is not the first key (as with the real CLI).
  const final = JSON.stringify({ ...base, ...envelope, ...(streaming ? { type: "result" } : {}) });
  process.stdout.write(streaming ? '{"type":"system","subtype":"init"}\\n' + final + "\\n" : final);
  process.exit(code);
};
const fail = (envelope) => out({ is_error: true, ...envelope }, 1);
switch (prompt) {
  case "ok": out({ structured_output: { hook: "Hola" } });
  case "text": out({ result: "Acá va:\\n\`\`\`json\\n{\\"hook\\":\\"Hola\\"}\\n\`\`\`" });
  case "invalid": out({ structured_output: { hook: "" } });
  case "limit": fail({ result: "API Error: 429 rate_limit_error", api_error_status: 429, terminal_reason: "api_error" });
  case "limit-text": fail({ result: "Claude AI usage limit reached|" + (Math.floor(Date.now() / 1000) + 3600) });
  case "max-turns": fail({ terminal_reason: "max_turns", result: "" });
  case "auth": fail({ result: "Invalid bearer token", api_error_status: 401, terminal_reason: "api_error" });
  case "bad-model": fail({ result: "model not found", api_error_status: 404, terminal_reason: "api_error" });
  case "garbage": process.stderr.write("algo se rompió\\n"); process.stdout.write("no es json"); process.exit(1);
  case "sleep": setInterval(() => {}, 1000); break;
  case "inspect-images":
    out({ structured_output: { args, content: message.content.map((b) =>
      b.type === "image" ? { type: "image", media: b.source.media_type, bytes: Buffer.from(b.source.data, "base64").length } : { type: "text", text: b.text.split("\\n")[0] }) } });
  case "inspect":
    out({ structured_output: {
      cwd: process.cwd(), args, env: process.env, input,
      files: readdirSync("."), system: readFileSync("system-prompt.md", "utf8"),
    } });
}
`;

let dir: string;
let bin: string;
let workspaceRoot: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "radev-claude-test-"));
  bin = join(dir, "fake-claude.cjs");
  writeFileSync(bin, FAKE_CLI);
  chmodSync(bin, 0o755);
  workspaceRoot = join(dir, "runs");
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const env = { PATH: process.env.PATH, CLAUDE_CODE_OAUTH_TOKEN: "sk-ant-oat-test" };
const provider = (overrides: NodeJS.ProcessEnv = env) =>
  createClaudeCodeProvider({ env: overrides, bin, home: join(dir, "home"), workspaceRoot });

const schema = z.object({ hook: z.string().min(1) });
const task = (prompt: string, extra: Partial<GenerationTask<unknown>> = {}) =>
  ({
    task: "carousel.generate",
    brandId: "brand-1",
    prompt,
    files: { "CLAUDE.md": "# Marca\n", "task.json": "{}" },
    schema,
    model: "sonnet",
    ...extra,
  }) as GenerationTask<z.infer<typeof schema>>;

const errorOf = (result: GenerationResult<unknown>) => (result.ok ? null : result.error);
const runs = () => (existsSync(workspaceRoot) ? readdirSync(workspaceRoot) : []);

describe("claudeCredential", () => {
  it("takes the one defined", () => {
    expect(claudeCredential({ CLAUDE_CODE_OAUTH_TOKEN: "a" })).toEqual({
      name: "CLAUDE_CODE_OAUTH_TOKEN",
      value: "a",
    });
    expect(claudeCredential({ ANTHROPIC_API_KEY: "b" })?.name).toBe("ANTHROPIC_API_KEY");
    expect(claudeCredential({ CLAUDE_CODE_OAUTH_TOKEN: "  " })).toBeNull();
  });

  it("refuses both at once (rule 10)", () => {
    const both = { CLAUDE_CODE_OAUTH_TOKEN: "a", ANTHROPIC_API_KEY: "b" };
    expect(() => claudeCredential(both)).toThrow(/a la vez/);
    expect(() => createClaudeCodeProvider({ env: both, bin })).toThrow(/a la vez/);
  });
});

describe("buildClaudeArgs", () => {
  const flagOf = (args: string[]) => (name: string) =>
    args.includes(name) ? args[args.indexOf(name) + 1] : undefined;

  it("passes the verified flags, the JSON Schema and the brand's system prompt, without tools", () => {
    const args = buildClaudeArgs(task("hola"));
    expect(args[0]).toBe("-p");
    expect(args).not.toContain("hola");
    const flag = flagOf(args);
    expect(flag("--output-format")).toBe("json");
    expect(JSON.parse(flag("--json-schema") ?? "")).toMatchObject({ type: "object" });
    expect(flag("--max-turns")).toBe("3");
    expect(flag("--system-prompt-file")).toBe("system-prompt.md");
    expect(flag("--tools")).toBe("");
    expect(flag("--allowedTools")).toBeUndefined();
    expect(flag("--model")).toBe("sonnet");
    expect(flag("--setting-sources")).toBe("project");
    expect(args).toContain("--no-session-persistence");
    expect(args).toContain("--strict-mcp-config");
  });

  it("allows only the tools the task asks for", () => {
    const flag = flagOf(buildClaudeArgs(task("hola", { tools: ["WebSearch", "WebFetch"] })));
    expect(flag("--tools")).toBe("WebSearch,WebFetch");
    expect(flag("--allowedTools")).toBe("WebSearch,WebFetch");
  });

  it("keeps Claude Code's own system prompt when there are no brand instructions", () => {
    const args = buildClaudeArgs(task("hola", { files: { "task.json": "{}" } }));
    expect(args).not.toContain("--system-prompt-file");
  });
});

describe("buildClaudeFiles", () => {
  it("never writes a CLAUDE.md: the instructions go as the system prompt, the rest inline", () => {
    const files = buildClaudeFiles(task("hola"));
    expect(Object.keys(files).sort()).toEqual(["prompt.md", "system-prompt.md"]);
    expect(files["system-prompt.md"]).toBe("# Marca\n");
    expect(files["prompt.md"]).toMatch(/^hola\n/);
    expect(files["prompt.md"]).toContain("### Archivo `task.json`");
  });
});

describe("classifyEnvelopeError", () => {
  const base = { is_error: true };
  it("maps 429 and the usage-limit text to rate_limited, with the reset time when given", () => {
    expect(classifyEnvelopeError({ ...base, api_error_status: 429 }).kind).toBe("rate_limited");
    const now = 1_700_000_000_000;
    const error = classifyEnvelopeError(
      { ...base, result: `Claude AI usage limit reached|${now / 1000 + 600}` },
      now,
    );
    expect(error).toMatchObject({ kind: "rate_limited", retryAfterMs: 600_000 });
  });

  it("says whether trying again could help", () => {
    const error = (envelope: object) => classifyEnvelopeError({ ...base, ...envelope });
    expect(error({ api_error_status: 401 })).toMatchObject({ retryable: false });
    expect(error({ api_error_status: 404 })).toMatchObject({ retryable: false });
    expect(error({ api_error_status: 529 })).toMatchObject({ retryable: true });
    expect(error({ terminal_reason: "max_turns" })).toMatchObject({ retryable: true });
  });
});

describe("createClaudeCodeProvider", () => {
  it("returns the validated structured output with its usage, and cleans the workspace", async () => {
    const result = await provider().generate(task("ok"));
    expect(result).toMatchObject({ ok: true, data: { hook: "Hola" } });
    expect(result.usage).toMatchObject({
      provider: "claude-code",
      model: "claude-sonnet-x",
      inputTokens: 20,
      outputTokens: 20,
      numTurns: 2,
      sessionId: "s-1",
    });
    expect(runs()).toEqual([]);
  });

  it("falls back to JSON inside the text", async () => {
    const result = await provider().generate(task("text"));
    expect(result).toMatchObject({ ok: true, data: { hook: "Hola" } });
  });

  it("validates with Zod whatever the CLI returns (rule 4) and keeps the failed workspace", async () => {
    const result = await provider().generate(task("invalid"));
    expect(result).toMatchObject({ ok: false, error: { kind: "validation" } });
    expect(result.usage).not.toBeNull();
    expect(runs()).toHaveLength(1);
  });

  it("maps the CLI errors", async () => {
    const kinds = async (prompt: string) => errorOf(await provider().generate(task(prompt)));
    expect(await kinds("limit")).toMatchObject({ kind: "rate_limited" });
    const limitText = await kinds("limit-text");
    expect(limitText).toMatchObject({ kind: "rate_limited" });
    expect(limitText?.kind === "rate_limited" && limitText.retryAfterMs).toBeGreaterThan(0);
    expect(await kinds("max-turns")).toMatchObject({ kind: "provider_error", retryable: true });
    expect(await kinds("auth")).toMatchObject({ kind: "provider_error", retryable: false });
    expect(await kinds("bad-model")).toMatchObject({ kind: "provider_error", retryable: false });
    const garbage = await kinds("garbage");
    expect(garbage).toMatchObject({ kind: "provider_error", retryable: true });
    expect(garbage?.message).toContain("algo se rompió");
  });

  it("stops a run that takes too long", async () => {
    const result = await provider().generate(task("sleep", { timeoutMs: 300 }));
    expect(result).toMatchObject({ ok: false, error: { kind: "provider_error", retryable: true } });
    expect(errorOf(result)?.message).toMatch(/no respondió/);
  });

  it("stops a run when the job is cancelled", async () => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 200);
    const result = await provider().generate(task("sleep", { signal: controller.signal }));
    expect(errorOf(result)?.message).toMatch(/canceló/);
  });

  it("runs in the workspace with the prompts and only the environment the CLI needs", async () => {
    const schemaAny = z.object({
      cwd: z.string(),
      args: z.array(z.string()),
      env: z.record(z.string(), z.string()),
      input: z.string(),
      files: z.array(z.string()),
      system: z.string(),
    });
    const leaky = { ...env, DATABASE_URL: "postgres://secret", RENDER_TOKEN: "secret" };
    const result = await provider(leaky).generate({ ...task("inspect"), schema: schemaAny });
    if (!result.ok) throw new Error(result.error.message);
    const seen = result.data;
    expect(seen.cwd.startsWith(workspaceRoot)).toBe(true);
    expect(seen.files.sort()).toEqual(["prompt.md", "system-prompt.md"]);
    expect(seen.system).toBe("# Marca\n");
    expect(seen.input).toContain("### Archivo `task.json`");
    expect(seen.env.CLAUDE_CODE_OAUTH_TOKEN).toBe("sk-ant-oat-test");
    expect(seen.env.HOME).toBe(join(dir, "home"));
    expect(seen.env.DISABLE_AUTOUPDATER).toBe("1");
    expect(seen.env.DATABASE_URL).toBeUndefined();
    expect(seen.env.RENDER_TOKEN).toBeUndefined();
    expect(seen.env.ANTHROPIC_API_KEY).toBeUndefined();
  });

  it("sends images in a stream-json message, each after the line that names it (ADR 0024)", async () => {
    const images = [
      { id: "a1", note: "cargar un gasto", mime: "image/png" as const, data: new Uint8Array(7) },
      { id: "b2", note: "el informe", mime: "image/jpeg" as const, data: new Uint8Array(3) },
    ];
    const seenSchema = z.object({ args: z.array(z.string()), content: z.array(z.unknown()) });
    const result = await provider().generate({
      ...task("inspect-images", { images }),
      schema: seenSchema,
    });
    if (!result.ok) throw new Error(result.error.message);
    expect(result.data.content).toEqual([
      { type: "text", text: "Captura `a1`: cargar un gasto" },
      { type: "image", media: "image/png", bytes: 7 },
      { type: "text", text: "Captura `b2`: el informe" },
      { type: "image", media: "image/jpeg", bytes: 3 },
      { type: "text", text: "inspect-images" },
    ]);
    expect(result.data.args.join(" ")).toContain(
      "--input-format stream-json --output-format stream-json --verbose",
    );
    expect(result.usage).toMatchObject({ numTurns: 2, sessionId: "s-1" });
  });

  it("reads the result event of a stream, errors included", async () => {
    const images = [{ id: "a1", note: "una", mime: "image/png" as const, data: new Uint8Array(1) }];
    expect(await provider().generate(task("ok", { images }))).toMatchObject({
      ok: true,
      data: { hook: "Hola" },
    });
    expect(errorOf(await provider().generate(task("limit", { images })))).toMatchObject({
      kind: "rate_limited",
    });
  });

  it("fails without spawning when there is no credential", async () => {
    const result = await provider({ PATH: process.env.PATH }).generate(task("ok"));
    expect(result).toMatchObject({
      ok: false,
      error: { kind: "provider_error", retryable: false },
    });
    expect(errorOf(result)?.message).toMatch(/CLAUDE_CODE_OAUTH_TOKEN/);
    expect(runs()).toEqual([]);
  });

  it("reports a missing binary", async () => {
    const missing = createClaudeCodeProvider({ env, bin: join(dir, "nope"), workspaceRoot });
    const result = await missing.generate(task("ok"));
    expect(result).toMatchObject({
      ok: false,
      error: { kind: "provider_error", retryable: false },
    });
  });
});

describe("resolveClaudeBin", () => {
  it("finds the pinned CLI", () => {
    expect(existsSync(resolveClaudeBin())).toBe(true);
  });
});
