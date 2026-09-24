import type { AiProviderId } from "@radev/core";
import type { AIError } from "./errors";
import { parseOutput } from "./schema";
import type { AIProvider, GenerationResult, GenerationTask, Usage } from "./types";

// A provider that answers from a function, for tests of the router and the jobs. It goes through
// the same validation as the real ones, so a wrong fake answer fails like a wrong model answer.

export type FakeAnswer = { output: unknown } | { error: AIError };

export function createFakeProvider(
  respond: (task: GenerationTask<unknown>) => FakeAnswer | Promise<FakeAnswer>,
  id: AiProviderId = "openrouter",
): AIProvider & { calls: GenerationTask<unknown>[] } {
  const calls: GenerationTask<unknown>[] = [];
  return {
    id,
    calls,
    async generate<T>(task: GenerationTask<T>): Promise<GenerationResult<T>> {
      calls.push(task as GenerationTask<unknown>);
      const answer = await respond(task as GenerationTask<unknown>);
      const usage: Usage = {
        provider: id,
        model: task.model,
        inputTokens: 0,
        outputTokens: 0,
        costUsd: null,
        durationMs: 0,
        numTurns: 1,
        sessionId: null,
      };
      if ("error" in answer) return { ok: false, error: answer.error, usage: null };
      const parsed = parseOutput(task.schema, answer.output);
      return parsed.ok
        ? { ok: true, data: parsed.data, usage }
        : { ok: false, error: parsed.error, usage };
    },
  };
}
