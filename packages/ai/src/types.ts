import type { AiProviderId, AiTask } from "@radev/core";
import type { z } from "zod";
import type { AIError } from "./errors";

/** What a job asks a provider for. The same task can go to any provider (routing, T6). */
export type GenerationTask<T> = {
  task: AiTask;
  brandId: string;
  /** Instructions of this run. The brand's voice and rules travel in `files` (CLAUDE.md). */
  prompt: string;
  /**
   * Context files by name (`CLAUDE.md`, `task.json`, `recent-posts.json`…). Both providers inline
   * them (`inlineTask`): `CLAUDE.md` as the system prompt, the rest inside the prompt.
   */
  files: Readonly<Record<string, string>>;
  /** Shape of the output. Every result is validated with it, whatever the provider (rule 4). */
  schema: z.ZodType<T>;
  /** Model id as the provider names it; comes from the routing table, never from code. */
  model: string;
  /**
   * Images the model looks at (ADR 0024: the post's screenshots), in order. claude-code sends them
   * in the message; a provider without vision skips them, so whatever the model must know about
   * them also goes in `files` (their notes).
   */
  images?: readonly TaskImage[];
  /** Extra tools (claude-code only), e.g. WebSearch for ideas.research. None by default. */
  tools?: readonly string[];
  maxTurns?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
};

/** An image of a task: its file and how the prompt refers to it. */
export type TaskImage = {
  /** What the prompt calls it (a screenshot's id). */
  id: string;
  /** What it shows, in the operator's words. */
  note: string;
  mime: "image/png" | "image/jpeg" | "image/webp";
  data: Uint8Array;
};

/** What a run consumed. Goes to generation_runs (T6). */
export type Usage = {
  provider: AiProviderId;
  /** The model that actually answered (it can differ from the requested alias). */
  model: string;
  inputTokens: number;
  outputTokens: number;
  /** List price reported by the provider; with the Claude subscription nothing is charged. */
  costUsd: number | null;
  durationMs: number;
  numTurns: number | null;
  sessionId: string | null;
};

export type GenerationResult<T> =
  | { ok: true; data: T; usage: Usage }
  /** `usage` is null when the provider failed before answering. */
  | { ok: false; error: AIError; usage: Usage | null };

export interface AIProvider {
  readonly id: AiProviderId;
  generate<T>(task: GenerationTask<T>): Promise<GenerationResult<T>>;
}
