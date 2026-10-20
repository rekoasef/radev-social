import { describe, expect, it } from "vitest";
import { buildRewriteFiles } from "./slide-rewrite";

const carousel = {
  hook: "h",
  slides: [
    { type: "cover", title: "Portada" },
    { type: "statement", title: "Una afirmación", layout: { title: { x: 0, y: 120 } } },
    { type: "cta", title: "Cierre", button: "Escribime" },
  ],
};

const read = (files: Record<string, string>, name: string) => JSON.parse(files[name] ?? "null");

describe("buildRewriteFiles", () => {
  it("gives the slide, the instruction and the whole carousel without hand adjustments", () => {
    const files = buildRewriteFiles({
      carousel,
      slideIndex: 1,
      instruction: "más directa",
      data: null,
    });
    expect(Object.keys(files).sort()).toEqual(["carousel.json", "slides.md", "task.json"]);
    const task = read(files, "task.json");
    expect(task).toMatchObject({
      slide: 2,
      totalSlides: 3,
      currentType: "statement",
      instruction: "más directa",
    });
    expect(task.rules.join(" ")).toContain("No puede ser `cover` ni `cta`");
    expect(read(files, "carousel.json").slides[1].layout).toBeUndefined();
  });

  it("asks for a better slide without an instruction, and keeps the cover a cover", () => {
    const task = read(
      buildRewriteFiles({ carousel, slideIndex: 0, instruction: "", data: null }),
      "task.json",
    );
    expect(task.instruction).toMatch(/^Mejorala/);
    expect(task.rules.join(" ")).toContain("seguir siendo `cover`");
  });

  it("adds data.json and the previous problems when there are", () => {
    const data = { asOf: "2026-09-29", datasets: {}, figures: [] };
    const files = buildRewriteFiles({
      carousel,
      slideIndex: 1,
      instruction: "",
      data,
      problems: ["slide.title › Tiene 90 caracteres"],
    });
    expect(read(files, "data.json")).toEqual(data);
    expect(read(files, "task.json").previousProblems).toEqual([
      "slide.title › Tiene 90 caracteres",
    ]);
  });

  it("gives the screenshots of the post and lets the slide become a screen (ADR 0024)", () => {
    const screenshots = [{ id: "s1", note: "cargar un gasto", device: "phone" as const }];
    const files = buildRewriteFiles({
      carousel,
      slideIndex: 1,
      instruction: "mostrá la captura",
      data: null,
      screenshots,
    });
    expect(read(files, "screenshots.json")).toEqual(screenshots);
    expect(files["slides.md"]).toContain("## Capturas");
    expect(read(files, "task.json").rules.join(" ")).toContain("captura de pantalla → `screen`");
    const without = buildRewriteFiles({ carousel, slideIndex: 1, instruction: "", data: null });
    expect(without["screenshots.json"]).toBeUndefined();
    expect(read(without, "task.json").rules.join(" ")).not.toContain("`screen`");
  });
});

describe("buildRewriteFiles: compositions and a repeated answer", () => {
  it("with the post's look, lets the slide change its composition", () => {
    const files = buildRewriteFiles({
      carousel,
      slideIndex: 1,
      instruction: "se ve mal",
      data: null,
      look: "editorial",
    });
    expect(files["slides.md"]).toContain("## Composición");
    expect(read(files, "task.json").rules.join(" ")).toContain("cambiá también su `composition`");
    const without = buildRewriteFiles({ carousel, slideIndex: 1, instruction: "", data: null });
    expect(without["slides.md"]).not.toContain("## Composición");
  });

  it("asks for more content in a type that has room for it", () => {
    const task = read(
      buildRewriteFiles({ carousel, slideIndex: 1, instruction: "más contenido", data: null }),
      "task.json",
    );
    expect(task.rules.join(" ")).toContain("sumá contenido de verdad");
  });

  it("shows the previous answer when it came back practically the same", () => {
    const previous = { type: "statement", title: "Una afirmación" };
    const task = read(
      buildRewriteFiles({
        carousel,
        slideIndex: 1,
        instruction: "",
        data: null,
        tooSimilar: previous,
      }),
      "task.json",
    );
    expect(task.previousAnswer).toEqual(previous);
    expect(task.previousAnswerNote).toMatch(/casi igual/);
  });
});
