import { z } from "zod";
import { type AIError, validationError } from "./errors";

// Schemas in and out of the providers. The JSON Schema goes to the model (claude --json-schema,
// OpenRouter's response_format); the Zod schema checks what comes back, always (CLAUDE.md, rule 4).

/**
 * JSON Schema of what the model must produce. `io: "input"`: fields with defaults stay optional.
 * Refinements (limits across fields, emphasis count) can't be expressed there: `parseOutput`
 * enforces them. Without `$schema`, the shape verified with claude -p in phase 3, T0.
 */
export function toJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const { $schema: _, ...json } = z.toJSONSchema(schema, { io: "input", unrepresentable: "any" });
  return json;
}

/** Issues as `path › message`, the same format the brand editor uses. */
export function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.map(String).join(".");
    return path ? `${path} › ${issue.message}` : issue.message;
  });
}

export function parseOutput<T>(
  schema: z.ZodType<T>,
  raw: unknown,
): { ok: true; data: T } | { ok: false; error: AIError } {
  const parsed = schema.safeParse(raw);
  if (parsed.success) return { ok: true, data: parsed.data };
  return { ok: false, error: validationError(formatIssues(parsed.error)) };
}

/**
 * Output that arrives as text (providers without structured output, or a model that wraps the
 * JSON in prose or a ```json fence): takes the outermost JSON object and parses it.
 */
export function parseJsonText<T>(
  schema: z.ZodType<T>,
  text: string,
): { ok: true; data: T } | { ok: false; error: AIError } {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) {
    return { ok: false, error: validationError(["La respuesta no trae un objeto JSON."]) };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text.slice(start, end + 1));
  } catch {
    return { ok: false, error: validationError(["La respuesta no es JSON válido."]) };
  }
  return parseOutput(schema, raw);
}
