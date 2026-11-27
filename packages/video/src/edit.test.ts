import { describe, expect, it } from "vitest";
import candidates from "../test/fixtures/mona-candidates.json";
import dossier from "../test/fixtures/mona-dossier.json";
import mona from "../test/fixtures/mona-script.json";
import { commonsTitle, editScene, operatorError } from "./edit";
import { scriptSchema } from "./script";

const script = () => scriptSchema.parse(structuredClone(mona));
const text = JSON.stringify(dossier);
const edit = (change: Parameters<typeof editScene>[1]) =>
  editScene(script(), change, candidates, text);

describe("editScene", () => {
  it("changes the narration without touching the original and drops lost highlights", () => {
    const original = script();
    const narration =
      "21 de agosto de 1911. El museo no abre y la Mona Lisa ya no está en su sitio.";
    const r = editScene(original, { scene: 1, narration }, candidates, text);
    if (!r.ok) throw new Error(r.errors.join(" "));
    expect(r.script.scenes[0]?.narration).toBe(narration);
    expect(r.script.scenes[0]?.highlight).toBeUndefined();
    expect(original).toEqual(script());
  });

  it("refuses a number that is not in the dossier (rule 9)", () => {
    const narration = `${script().scenes[1]?.narration} Eran 7777.`;
    const r = edit({ scene: 2, narration });
    expect(r).toMatchObject({ ok: false });
    if (!r.ok) expect(r.errors.join(" ")).toMatch(/Escena 2: .*7777/);
  });

  it("refuses an image that is not a candidate and removes an emptied caption", () => {
    expect(edit({ scene: 1, image: "i99" })).toMatchObject({ ok: false });
    const r = edit({ scene: 1, caption: "  " });
    expect(r.ok && r.script.scenes[0]?.caption).toBeUndefined();
  });

  it("lets the operator pick an image another scene already uses", () => {
    const r = edit({ scene: 10, image: script().scenes[2]?.image });
    expect(r.ok).toBe(true);
  });

  it("resets the framing only when the image changes", () => {
    const same = edit({ scene: 1, image: script().scenes[0]?.image });
    expect(same.ok && same.script.scenes[0]?.from).toEqual(script().scenes[0]?.from);
  });

  it("refuses a scene that does not exist", () => {
    expect(edit({ scene: 99, caption: "x" })).toEqual({
      ok: false,
      errors: ["Esa escena no existe."],
    });
  });
});

describe("operatorError", () => {
  it("names the scene as the operator counts it", () => {
    expect(operatorError("scenes.3.graphics.0.at › falta la palabra")).toBe(
      "Escena 4: falta la palabra",
    );
    expect(operatorError("scenes › la narración suma 2000")).toBe("la narración suma 2000");
  });
});

describe("commonsTitle", () => {
  it("takes the name from a page address or a File: name", () => {
    const url = "https://commons.wikimedia.org/wiki/File:Mona_Lisa_stolen-1911.jpg";
    expect(commonsTitle(url)).toBe("Mona Lisa stolen-1911.jpg");
    expect(commonsTitle("Archivo:Louvre%.png")).toBe("Louvre%.png");
    expect(commonsTitle("  File:Atget - Port du Louvre.JPEG ")).toBe("Atget - Port du Louvre.JPEG");
  });

  it("is null for anything else", () => {
    expect(commonsTitle("https://example.com/File:a.jpg")).toBeNull();
    expect(commonsTitle("la foto del Louvre")).toBeNull();
    expect(commonsTitle("File:libro.pdf")).toBeNull();
  });
});
