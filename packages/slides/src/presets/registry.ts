import type { z } from "zod";
import { type BoldTokens, boldTokensSchema } from "./bold/tokens";
import { type SoftTokens, softTokensSchema } from "./soft/tokens";
import { type StudioTokens, studioTokensSchema } from "./studio/tokens";

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
  studio: {
    name: "Studio",
    description:
      "Varios looks para una misma marca (editorial, bloques, atmósfera, plano, terminal, recorte…): cada post usa uno distinto.",
    tokens: studioTokensSchema,
  },
} as const;

export type StylePreset = keyof typeof presets;
export const STYLE_PRESETS = Object.keys(presets) as StylePreset[];

export type BrandTheme =
  | { preset: "bold"; tokens: BoldTokens }
  | { preset: "soft"; tokens: SoftTokens }
  | { preset: "studio"; tokens: StudioTokens };

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
    case "studio": {
      const result = studioTokensSchema.safeParse(tokens);
      return result.success
        ? { ok: true, theme: { preset, tokens: result.data } }
        : { ok: false, issues: describeIssues(result.error) };
    }
    default:
      return { ok: false, issues: [`No existe el preset "${preset}".`] };
  }
}

export type ThemeCheck =
  | { ok: true; theme: BrandTheme }
  | { ok: false; fields: Record<string, string> };

/**
 * Like parseTheme, with the problems keyed by token path ("colors.accent") for the panel's
 * form. Only the first message of each field is kept.
 */
export function checkTheme(preset: string, tokens: unknown): ThemeCheck {
  if (!isStylePreset(preset))
    return { ok: false, fields: { "": `No existe el preset "${preset}".` } };
  const result = presets[preset].tokens.safeParse(tokens);
  if (result.success) {
    return { ok: true, theme: { preset, tokens: result.data } as BrandTheme };
  }
  const fields: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.map(String).join(".");
    fields[key] ??= issue.message;
  }
  return { ok: false, fields };
}

/**
 * Tokens for a brand that switches preset: the new preset's defaults, keeping the assets both
 * presets have (e.g. the logo), so uploaded files stay linked.
 */
export function switchPresetTokens(to: StylePreset, from: unknown): BrandTheme["tokens"] {
  const next: Record<string, unknown> = { ...defaultTokens(to) };
  const old = (from ?? {}) as Record<string, unknown>;
  for (const key of Object.keys(next)) {
    if (key.endsWith("Asset") && typeof old[key] === "string") next[key] = old[key];
  }
  return next as BrandTheme["tokens"];
}

/** The main colors of a brand's identity, whatever its preset (panel swatches and cards). */
export function themeColors(theme: BrandTheme): {
  bg: string;
  text: string;
  accent: string;
  muted: string;
} {
  if (theme.preset === "studio") {
    const { ink, paper, accent } = theme.tokens.colors;
    return { bg: ink, text: paper, accent, muted: `color-mix(in srgb, ${paper} 62%, ${ink})` };
  }
  const { bg, text, accent, muted } = theme.tokens.colors;
  return { bg, text, accent, muted };
}

/** Complete tokens for a brand that just picked the preset. */
export function defaultTokens(preset: StylePreset): BrandTheme["tokens"] {
  return presets[preset].tokens.parse({});
}
