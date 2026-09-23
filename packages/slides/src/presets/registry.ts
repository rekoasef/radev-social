import type { z } from "zod";
import { type BoldTokens, boldTokensSchema } from "./bold/tokens";
import { type SoftTokens, softTokensSchema } from "./soft/tokens";

// Style presets (docs/DESIGN-SYSTEM.md §2): personality in code, values as brand tokens.

export const presets = {
  bold: {
    name: "Bold",
    description:
      "Fuerte y directo: títulos enormes en mayúsculas, acento brillante, tarjetas con borde luminoso.",
    tokens: boldTokensSchema,
  },
  soft: {
    name: "Soft",
    description:
      "Calmo y premium: títulos en oración, mucho aire, paneles de vidrio y glows suaves.",
    tokens: softTokensSchema,
  },
} as const;

export type StylePreset = keyof typeof presets;
export const STYLE_PRESETS = Object.keys(presets) as StylePreset[];

export type BrandTheme =
  | { preset: "bold"; tokens: BoldTokens }
  | { preset: "soft"; tokens: SoftTokens };

export type ThemeResult = { ok: true; theme: BrandTheme } | { ok: false; issues: string[] };

export function isStylePreset(value: string): value is StylePreset {
  return Object.hasOwn(presets, value);
}

function describeIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) =>
    issue.path.length > 0 ? `${issue.path.join(" › ")}: ${issue.message}` : issue.message,
  );
}

/** Validates stored tokens against their preset, filling in defaults for missing fields. */
export function parseTheme(preset: string, tokens: unknown): ThemeResult {
  switch (preset) {
    case "bold": {
      const result = boldTokensSchema.safeParse(tokens);
      return result.success
        ? { ok: true, theme: { preset, tokens: result.data } }
        : { ok: false, issues: describeIssues(result.error) };
    }
    case "soft": {
      const result = softTokensSchema.safeParse(tokens);
      return result.success
        ? { ok: true, theme: { preset, tokens: result.data } }
        : { ok: false, issues: describeIssues(result.error) };
    }
    default:
      return { ok: false, issues: [`No existe el preset "${preset}".`] };
  }
}

/** Complete tokens for a brand that just picked the preset. */
export function defaultTokens(preset: StylePreset): BrandTheme["tokens"] {
  return presets[preset].tokens.parse({});
}
