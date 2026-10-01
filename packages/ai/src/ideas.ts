import { IDEA_ANGLE_MAX, IDEA_SOURCES_MAX, IDEA_TITLE_MAX, IDEA_TITLE_MIN } from "@radev/core";
import { z } from "zod";

// What the AI answers when it proposes ideas (ideas.generate) or brings them from its research
// (ideas.research), phase 3 T10. Validated with Zod whatever the provider (CLAUDE.md, rule 4).

/**
 * Figures a post must never get from an idea: percentages, amounts and "N mil/millones". They
 * come only from the brand's documents or real data (rule 9). Counts like "3 errores" are fine.
 */
const FIGURE_PATTERN =
  /\d\s*%|[$€]\s*\d|\b(?:usd|us\$|ars|eur)\s*\d|\d[\d.,]*\s*(?:usd|dólares|pesos|euros|mil\b|millones|k\b)/i;

export function hasFigures(text: string): boolean {
  return FIGURE_PATTERN.test(text);
}

export type IdeaSchemaOptions = {
  /** Pillars the ideas can take (one when the request fixes the pillar). */
  pillarKeys: readonly string[];
  count: number;
  /** ideas.research: every idea brings the pages it comes from. */
  research: boolean;
};

const withoutFigures = (schema: z.ZodString) =>
  schema.refine((text) => !hasFigures(text), {
    error: "Sin porcentajes ni montos: los números salen de los datos de la marca.",
  });

const sourceSchema = z.object({
  title: z.string().trim().min(1).max(160),
  url: z.url({ protocol: /^https?$/, error: "Tiene que ser un link http(s)." }).max(500),
});

/** The answer's shape for one request. */
export function ideaProposalsSchema(options: IdeaSchemaOptions) {
  const { pillarKeys, count, research } = options;
  const idea = z.object({
    title: withoutFigures(z.string().trim().min(IDEA_TITLE_MIN).max(IDEA_TITLE_MAX)),
    angle: withoutFigures(z.string().trim().max(IDEA_ANGLE_MAX)),
    pillarKey: z.enum(pillarKeys as [string, ...string[]]),
    ...(research && {
      sources: z.array(sourceSchema).min(1).max(IDEA_SOURCES_MAX),
    }),
  });
  return z.object({ ideas: z.array(idea).min(1).max(count) });
}

export type IdeaProposals = z.infer<ReturnType<typeof ideaProposalsSchema>>;
export type IdeaProposal = IdeaProposals["ideas"][number] & {
  sources?: { title: string; url: string }[];
};

/**
 * Near-duplicates the model proposed anyway: same title as an existing idea or another idea of
 * the answer, ignoring case, accents and punctuation. The job drops them.
 */
export function normalizeIdeaTitle(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function dropRepeatedIdeas<T extends { title: string }>(
  proposed: readonly T[],
  existingTitles: readonly string[],
): T[] {
  const seen = new Set(existingTitles.map(normalizeIdeaTitle));
  return proposed.filter((idea) => {
    const key = normalizeIdeaTitle(idea.title);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
