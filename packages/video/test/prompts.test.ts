import { describe, expect, it } from "vitest";
import { PROMPT_VERSION, PUBLICATION_RULES, REVIEW_RULES, SCRIPT_RULES } from "../src";

describe("prompts", () => {
  it("cada oficina con IA tiene sus instrucciones, con backticks y sin restos de plantilla", () => {
    expect(SCRIPT_RULES).toContain("Guionista de documentales");
    expect(SCRIPT_RULES).toContain("`dossier.json`");
    expect(SCRIPT_RULES).not.toContain("\\`");
    expect(REVIEW_RULES).toContain("Verificador de hechos");
    expect(REVIEW_RULES).toContain("`guion.json`");
    expect(PUBLICATION_RULES).toContain("Responsable de publicación");
    expect(PUBLICATION_RULES).toContain("thumbnail");
    expect(PROMPT_VERSION).toBeGreaterThan(0);
  });

  it("el guionista sabe que el video sale en dos formatos", () => {
    expect(SCRIPT_RULES).toMatch(/dos formatos/);
  });
});
