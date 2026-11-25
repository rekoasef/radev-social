import { describe, expect, it } from "vitest";
import { checkSources, overlap, pageText, resultOf } from "../src";
import { monaDossier } from "./fixtures";

describe("pageText", () => {
  it("keeps the visible text, with entities, without scripts, styles or tags", () => {
    const html =
      "<style>p{}</style><p>Peruggia &amp; el Louvre&nbsp;en 1911</p><script>x=1</script>";
    expect(pageText(html).replace(/\s+/g, " ").trim()).toBe("Peruggia & el Louvre en 1911");
  });
});

describe("overlap and resultOf", () => {
  const page = "el 21 de agosto de 1911 peruggia salio del louvre con la mona lisa bajo el abrigo";
  it("is 1 for a verbatim excerpt, partial for a paraphrase, 0 for another text", () => {
    expect(overlap("21 de agosto de 1911 Peruggia salió del Louvre", page)).toBe(1);
    const half = overlap("21 de agosto de 1911 peruggia llegó tarde al trabajo ese lunes", page);
    expect(half).toBeGreaterThan(0);
    expect(half).toBeLessThan(1);
    expect(overlap("nada que ver con la página", page)).toBe(0);
  });
  it("labels the result by how much of the excerpt is there", () => {
    expect(resultOf(1)).toBe("textual");
    expect(resultOf(0.7)).toBe("casi");
    expect(resultOf(0.2)).toBe("no-esta");
  });
});

describe("checkSources", () => {
  it("marks verbatim facts, missing pages and numbers the page does not have", () => {
    const d = monaDossier();
    const [a, b, c] = d.facts;
    if (!a || !b || !c) throw new Error("fixture");
    d.facts = [
      {
        ...a,
        excerpt:
          "El 21 de agosto de 1911 Peruggia salió del Louvre con la Mona Lisa bajo el abrigo",
        claim: "Salió el 21 de agosto de 1911",
        url: "https://a.org/1",
      },
      { ...b, url: "https://b.org/2" },
      {
        ...c,
        excerpt: "otro texto muy distinto que no está en la página para nada",
        claim: "Fueron 99999 agentes",
        url: "https://c.org/3",
      },
    ];
    const doc = checkSources(
      d,
      new Map<string, string | Error>([
        [
          "https://a.org/1",
          "<p>El 21 de agosto de 1911 Peruggia salió del Louvre con la Mona Lisa bajo el abrigo.</p>",
        ],
        ["https://b.org/2", new Error("HTTP 403")],
        ["https://c.org/3", "<p>Una página sobre otra cosa, en 1911.</p>"],
      ]),
    );
    expect(doc.facts.map((f) => f.result)).toEqual(["textual", "sin-pagina", "no-esta"]);
    expect(doc.facts[0]?.missingNumbers).toEqual([]);
    expect(doc.facts[1]?.error).toBe("HTTP 403");
    expect(doc.facts[2]?.missingNumbers).toEqual(["99999"]);
    expect(doc.summary).toEqual({ textual: 1, casi: 0, noEsta: 1, sinPagina: 1 });
  });
});
