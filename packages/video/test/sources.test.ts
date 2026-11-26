import { describe, expect, it } from "vitest";
import {
  betterFind,
  checkSources,
  overlap,
  pageChunks,
  pageText,
  readablePage,
  resultOf,
  type SourcesDoc,
  usableDossier,
} from "../src";
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
    d.quotes = [];
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

describe("checkSources with what an AI found reading the page (stage 4)", () => {
  const page =
    "<p>Cooper boarded with a black attaché case.</p><p>He asked for 200,000 dollars.</p>";
  const dossier = () => {
    const d = monaDossier();
    const base = d.facts[0];
    if (!base) throw new Error("fixture");
    d.facts = ["F1", "F2", "F3"].map((id) => ({
      ...base,
      id,
      url: "https://a.org/1",
      excerpt: "a summary that is not on the page at all, written by the search tool",
    }));
    d.quotes = [
      {
        id: "C1",
        text: "Se parecía casi al cien por cien",
        who: "Tina Mucklow",
        url: "https://a.org/1",
      },
    ];
    return d;
  };
  const pages = new Map<string, string | Error>([["https://a.org/1", page]]);

  it("checks the quotes too", () => {
    expect(checkSources(dossier(), pages).facts.map((f) => f.id)).toEqual(["F1", "F2", "F3", "C1"]);
  });

  const q = (quote: string | null, differs: string | null = null) => ({
    quotes: quote ? [quote] : [],
    differs,
  });

  it("textual when the AI's sentence is really on the page; absent when it is not", () => {
    const found = new Map([
      ["F1", q("Cooper boarded with a black attaché case.")],
      ["F2", q("He asked for 300,000 dollars in cash.")],
      ["F3", q(null)],
    ]);
    const doc = checkSources(dossier(), pages, found);
    expect(doc.facts.slice(0, 3).map((f) => [f.result, f.checked])).toEqual([
      ["textual", true],
      ["no-esta", true],
      ["no-esta", true],
    ]);
    expect(doc.facts[0]?.quote).toBe("Cooper boarded with a black attaché case.");
    expect(doc.facts[3]).not.toHaveProperty("checked");
  });

  it("accepts a fact spread over two sentences of the page, but not one invented among them", () => {
    const two = new Map([
      [
        "F1",
        {
          quotes: ["Cooper boarded with a black attaché case.", "He asked for 200,000 dollars."],
          differs: null,
        },
      ],
      [
        "F2",
        {
          quotes: ["Cooper boarded with a black attaché case.", "He jumped at night."],
          differs: null,
        },
      ],
    ]);
    const doc = checkSources(dossier(), pages, two);
    expect(doc.facts[0]).toMatchObject({ result: "textual", checked: true });
    expect(doc.facts[0]?.quote).toContain(" … ");
    expect(doc.facts[1]).toMatchObject({ result: "no-esta", checked: true });
  });

  it("almost, with what the page leaves out, when the sentence backs only part of it", () => {
    const found = new Map([
      ["F1", q("He asked for 200,000 dollars.", "no dice que fueran billetes de 20")],
    ]);
    expect(checkSources(dossier(), pages, found).facts[0]).toMatchObject({
      result: "casi",
      checked: true,
      differs: "no dice que fueran billetes de 20",
    });
  });

  it("does not call absent what was below the part of the page the AI read", () => {
    const doc = checkSources(
      dossier(),
      pages,
      new Map([["F3", q(null)]]),
      new Set(["https://a.org/1"]),
    );
    expect(doc.facts[2]).toMatchObject({ result: "no-esta", checked: false });
  });
});

describe("betterFind", () => {
  const find = (verified: boolean, differs: string | null, quotes = ["x"]) => ({
    quotes,
    differs,
    verified,
  });
  it("prefers whole over partial over invented over nothing", () => {
    expect(betterFind(undefined, find(false, null, []))).toBe(true);
    expect(betterFind(find(false, null, []), find(false, null))).toBe(true);
    expect(betterFind(find(false, null), find(true, "parte"))).toBe(true);
    expect(betterFind(find(true, "parte"), find(true, null))).toBe(true);
    expect(betterFind(find(true, null), find(true, "parte"))).toBe(false);
  });
});

describe("readablePage", () => {
  it("splits a long page between lines", () => {
    expect(pageChunks("aaa\nbbb\nccc", 7)).toEqual(["aaa\nbbb", "ccc"]);
    expect(pageChunks("x".repeat(10), 4)).toEqual(["xxxx"]);
  });

  it("keeps one block per line and says when it cut", () => {
    expect(readablePage("<p>uno</p><p>dos  tres</p><script>x</script>")).toEqual({
      text: "uno\ndos tres",
      cut: false,
    });
    expect(readablePage("<p>abcdef</p>", 3)).toEqual({ text: "abc", cut: true });
  });
});

describe("usableDossier", () => {
  const sources = (absent: string[], checked = true): SourcesDoc => ({
    facts: absent.map((id) => ({
      id,
      url: "https://a.org",
      result: "no-esta" as const,
      overlap: 0,
      missingNumbers: [],
      checked,
    })),
    summary: { textual: 0, casi: 0, noEsta: absent.length, sinPagina: 0 },
  });

  it("leaves out the facts and quotes their page does not back", () => {
    const d = monaDossier();
    const [f1] = d.facts;
    const quote = d.quotes[0];
    const { dossier, dropped } = usableDossier(d, sources([f1?.id ?? "", quote?.id ?? ""]));
    expect(dropped).toHaveLength(2);
    expect(dossier.facts).toHaveLength(d.facts.length - 1);
    expect(dossier.quotes).toHaveLength(d.quotes.length - 1);
  });

  it("keeps everything when the AI did not read the page, or when too few would be left", () => {
    const d = monaDossier();
    expect(usableDossier(d, sources([d.facts[0]?.id ?? ""], false)).dropped).toEqual([]);
    const most = d.facts.slice(0, Math.ceil(d.facts.length / 2)).map((f) => f.id);
    expect(usableDossier(d, sources(most)).dossier.facts).toHaveLength(d.facts.length);
    expect(usableDossier(d, null).dropped).toEqual([]);
  });
});

describe("usableDossier passes on the real sentences", () => {
  it("puts each fact's sentence in its excerpt and marks what the page does not say", () => {
    const d = monaDossier();
    const [a, b] = d.facts;
    if (!a || !b) throw new Error("fixture");
    const sources: SourcesDoc = {
      facts: [
        {
          id: a.id,
          url: a.url,
          result: "textual",
          overlap: 1,
          missingNumbers: [],
          quote: "Frase A.",
          checked: true,
        },
        {
          id: b.id,
          url: b.url,
          result: "casi",
          overlap: 1,
          missingNumbers: [],
          quote: "Frase B.",
          differs: "dice SR-71, no U-2",
          checked: true,
        },
      ],
      summary: { textual: 1, casi: 1, noEsta: 0, sinPagina: 0 },
    };
    const { dossier } = usableDossier(d, sources);
    expect(dossier.facts[0]).toMatchObject({ excerpt: "Frase A.", claim: a.claim });
    expect(dossier.facts[1]?.excerpt).toBe("Frase B.");
    expect(dossier.facts[1]?.claim).toContain("la página NO dice: dice SR-71, no U-2");
  });
});
