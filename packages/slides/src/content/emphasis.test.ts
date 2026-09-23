import { describe, expect, it } from "vitest";
import { countEmphasis, parseEmphasis } from "./emphasis";

describe("parseEmphasis", () => {
  it("splits emphasized fragments", () => {
    expect(parseEmphasis("Tenés información repartida en *5 lugares.*")).toEqual({
      ok: true,
      segments: [
        { text: "Tenés información repartida en ", emphasis: false },
        { text: "5 lugares.", emphasis: true },
      ],
      plain: "Tenés información repartida en 5 lugares.",
      fragments: 1,
    });
  });

  it("handles text without emphasis and emphasis at both ends", () => {
    expect(parseEmphasis("Sin énfasis")).toMatchObject({ ok: true, fragments: 0 });
    const parsed = parseEmphasis("*Uno* y *dos*");
    expect(parsed).toMatchObject({ ok: true, fragments: 2, plain: "Uno y dos" });
  });

  it.each([
    ["Un *asterisco sin cerrar", "Hay un asterisco sin cerrar."],
    ["Un *uno* y *otro", "Hay un asterisco sin cerrar."],
    ["Vacío ** acá", "Hay un énfasis vacío (**)."],
    ["Con * espacios *", "El énfasis no puede empezar ni terminar con un espacio."],
  ])("rejects %j", (input, error) => {
    expect(parseEmphasis(input)).toEqual({ ok: false, error });
  });
});

describe("countEmphasis", () => {
  it("counts fragments in nested values and ignores invalid texts", () => {
    const slide = { title: "*Uno*", nodes: [{ label: "x" }], body: "*dos* y *tres*", bad: "*roto" };
    expect(countEmphasis(slide)).toBe(3);
  });
});
