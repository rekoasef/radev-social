import { describe, expect, it } from "vitest";
import { isBrandDocumentKind, normalizeBrandDocument } from "./documents";

describe("normalizeBrandDocument", () => {
  it("unifies line endings, trims line ends and keeps one final newline", () => {
    expect(normalizeBrandDocument("# Voz  \r\n\r\nCercana.\t\r\n\r\n")).toBe("# Voz\n\nCercana.\n");
  });

  it("treats a whitespace-only document as empty", () => {
    expect(normalizeBrandDocument("  \n \r\n")).toBe("");
  });

  it("is idempotent", () => {
    const once = normalizeBrandDocument("a  \n\n  b\n\n\n");
    expect(normalizeBrandDocument(once)).toBe(once);
  });

  it("keeps indentation and blank lines inside the text", () => {
    expect(normalizeBrandDocument("- a\n  - b\n\n\ntexto")).toBe("- a\n  - b\n\n\ntexto\n");
  });
});

describe("isBrandDocumentKind", () => {
  it("accepts the four kinds only", () => {
    expect(isBrandDocumentKind("voice")).toBe(true);
    expect(isBrandDocumentKind("pricing")).toBe(true);
    expect(isBrandDocumentKind("notes")).toBe(false);
  });
});
