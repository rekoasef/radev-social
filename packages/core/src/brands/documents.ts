// Brand documents (docs/ARCHITECTURE.md §4, §7): the Markdown the AI reads to write like the brand.
// Versioned: every save adds a version, the current one is the highest. They go into the brand's
// CLAUDE.md in the generation workspace (phase 3, T3).

export const BRAND_DOCUMENT_KINDS = ["voice", "pricing", "cases", "rules"] as const;

export type BrandDocumentKind = (typeof BRAND_DOCUMENT_KINDS)[number];

/** Enough for long pricing tables; far below what a model context holds. */
export const MAX_BRAND_DOCUMENT_CHARS = 40_000;

export const isBrandDocumentKind = (value: string): value is BrandDocumentKind =>
  BRAND_DOCUMENT_KINDS.some((kind) => kind === value);

/**
 * Canonical form of a document: Unix line endings, no trailing spaces at line ends, one final
 * newline. Saving the same text from Windows or with stray spaces doesn't create a new version.
 */
export function normalizeBrandDocument(content: string): string {
  const lines = content
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd());
  const text = lines.join("\n").trim();
  return text === "" ? "" : `${text}\n`;
}
