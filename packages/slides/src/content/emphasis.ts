// Emphasis syntax (docs/DESIGN-SYSTEM.md §6): `*text*` marks a fragment that the preset renders
// with its emphasis style. No escaping and no nesting: a text with an odd number of asterisks
// is invalid.

export const MAX_EMPHASIS_PER_SLIDE = 2;

export type TextSegment = { text: string; emphasis: boolean };

export type ParsedText =
  | { ok: true; segments: TextSegment[]; plain: string; fragments: number }
  | { ok: false; error: string };

export function parseEmphasis(input: string): ParsedText {
  const parts = input.split("*");
  if (parts.length % 2 === 0) return { ok: false, error: "Hay un asterisco sin cerrar." };

  const segments: TextSegment[] = [];
  let fragments = 0;
  for (const [index, text] of parts.entries()) {
    const emphasis = index % 2 === 1;
    if (emphasis) {
      if (text.trim() === "") return { ok: false, error: "Hay un énfasis vacío (**)." };
      if (text !== text.trim()) {
        return { ok: false, error: "El énfasis no puede empezar ni terminar con un espacio." };
      }
      fragments++;
    }
    if (text !== "") segments.push({ text, emphasis });
  }
  return { ok: true, segments, plain: segments.map((s) => s.text).join(""), fragments };
}

function collectStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(collectStrings);
  if (typeof value === "object" && value !== null)
    return Object.values(value).flatMap(collectStrings);
  return [];
}

/** Emphasis fragments across every text of a value (e.g. a whole slide). */
export function countEmphasis(value: unknown): number {
  return collectStrings(value).reduce((total, text) => {
    const parsed = parseEmphasis(text);
    return total + (parsed.ok ? parsed.fragments : 0);
  }, 0);
}
