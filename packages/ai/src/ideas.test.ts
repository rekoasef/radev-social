import { describe, expect, it } from "vitest";
import { dropRepeatedIdeas, hasFigures, ideaProposalsSchema, normalizeIdeaTitle } from "./ideas";
import { toJsonSchema } from "./schema";

const base = {
  pillarKeys: ["business-problems", "build-in-public"],
  count: 3,
  research: false,
};

const idea = {
  title: "Por qué tu negocio pierde clientes por WhatsApp",
  angle: "Desde el dueño que responde tarde",
  pillarKey: "business-problems",
};

describe("hasFigures", () => {
  it.each([
    "El 70% de las pymes",
    "cuesta $ 500",
    "USD 1.200 por mes",
    "ahorrás 300 dólares",
    "más de 5 mil pesos",
    "2 millones de usuarios",
    "10k de facturación",
  ])("catches %j", (text) => {
    expect(hasFigures(text)).toBe(true);
  });

  it.each([
    "3 errores al contratar una web",
    "Lo que aprendí en 2026",
    "5 tareas que podés automatizar",
    "Pymes que usan planillas",
  ])("lets %j through", (text) => {
    expect(hasFigures(text)).toBe(false);
  });
});

describe("ideaProposalsSchema", () => {
  it("accepts ideas of the brand's pillars", () => {
    const parsed = ideaProposalsSchema(base).safeParse({
      ideas: [idea, { ...idea, title: "¿Cuánto cuesta realmente una web?" }],
    });
    expect(parsed.success ? [] : parsed.error.issues).toEqual([]);
  });

  it("refuses unknown pillars", () => {
    expect(
      ideaProposalsSchema(base).safeParse({ ideas: [{ ...idea, pillarKey: "otro" }] }).success,
    ).toBe(false);
  });

  it("no more ideas than asked, at least one", () => {
    const schema = ideaProposalsSchema(base);
    expect(schema.safeParse({ ideas: [idea, idea, idea, idea] }).success).toBe(false);
    expect(schema.safeParse({ ideas: [] }).success).toBe(false);
  });

  it("refuses figures in the title or the angle (rule 9)", () => {
    const parsed = ideaProposalsSchema(base).safeParse({
      ideas: [{ ...idea, angle: "El 80% de los negocios responde tarde" }],
    });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.path).toEqual(["ideas", 0, "angle"]);
  });

  it("research ideas bring 1 to 3 http(s) sources", () => {
    const schema = ideaProposalsSchema({ ...base, research: true });
    const source = { title: "Nota", url: "https://example.com/nota" };
    expect(schema.safeParse({ ideas: [{ ...idea, sources: [source] }] }).success).toBe(true);
    expect(schema.safeParse({ ideas: [{ ...idea, sources: [] }] }).success).toBe(false);
    expect(schema.safeParse({ ideas: [idea] }).success).toBe(false);
    expect(
      schema.safeParse({
        ideas: [{ ...idea, sources: [{ title: "x", url: "javascript:alert(1)" }] }],
      }).success,
    ).toBe(false);
  });

  it("turns into a JSON Schema the providers accept", () => {
    const json = toJsonSchema(ideaProposalsSchema({ ...base, research: true }));
    expect(json.type).toBe("object");
    expect(JSON.stringify(json)).toContain("business-problems");
  });
});

describe("repeated ideas", () => {
  it("normalizes case, accents and punctuation", () => {
    expect(normalizeIdeaTitle("¿Cuánto CUESTA una web?")).toBe("cuanto cuesta una web");
  });

  it("drops ideas already in the bank or repeated in the answer", () => {
    const kept = dropRepeatedIdeas(
      [
        { title: "Cuanto cuesta una web" },
        { title: "Bots de WhatsApp" },
        { title: "bots de whatsapp!" },
      ],
      ["¿Cuánto cuesta una web?"],
    );
    expect(kept).toEqual([{ title: "Bots de WhatsApp" }]);
  });
});
