// Theme tokens are not validated until the preset schemas exist (phase 1), so every read
// here is defensive: unknown shapes degrade to "not defined" instead of breaking the page.

export type Swatch = { name: string; value: string };
export type FontToken = { family: string; weight: number | undefined };

const COLOR = /^(#[0-9a-f]{3,8}|rgba?\(\s*[\d.\s,%]+\))$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readColors(tokens: unknown): Swatch[] {
  if (!isRecord(tokens) || !isRecord(tokens.colors)) return [];
  return Object.entries(tokens.colors).flatMap(([name, value]) =>
    typeof value === "string" && COLOR.test(value.trim()) ? [{ name, value: value.trim() }] : [],
  );
}

export function readColor(tokens: unknown, name: string): string | undefined {
  return readColors(tokens).find((swatch) => swatch.name === name)?.value;
}

export function readFont(tokens: unknown, role: string): FontToken | undefined {
  if (!isRecord(tokens) || !isRecord(tokens.fonts)) return undefined;
  const font = tokens.fonts[role];
  if (!isRecord(font) || typeof font.family !== "string") return undefined;
  return { family: font.family, weight: typeof font.weight === "number" ? font.weight : undefined };
}
