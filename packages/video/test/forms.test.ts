import type { VideoBeat, VideoForm } from "@radev/core";
import { describe, expect, it } from "vitest";
import { aiScriptSchema, checkForm, checkScript, compactDossier, type FormedScript } from "../src";
import { monaCandidates, monaDossier, monaScript } from "./fixtures";

/** A script as the checks see it: the roles in order, with `cards` carrying a name card. */
const told = (form: VideoForm, beats: VideoBeat[], cards: number[] = []): FormedScript => ({
  form,
  scenes: beats.map((beat, i) => ({
    beat,
    graphics: cards.includes(i) ? [{ kind: "nombre" }] : [],
  })),
});
const times = (beat: VideoBeat, n: number): VideoBeat[] => Array.from({ length: n }, () => beat);

const mystery: VideoBeat[] = [
  "gancho",
  "pregunta",
  ...times("pista", 5),
  "giro",
  "revelacion",
  "cierre",
];
const contrast: VideoBeat[] = [
  "gancho",
  ...(["ladoA", "ladoB", "ladoA", "ladoB", "ladoA", "ladoB"] as const),
  "veredicto",
  "cierre",
];
const after: VideoBeat[] = ["gancho", ...times("hecho", 2), ...times("despues", 6), "cierre"];
const chronology: VideoBeat[] = ["gancho", "pregunta", ...times("hecho", 7), "cierre"];
const errors = (g: FormedScript, request?: Parameters<typeof checkForm>[1]) =>
  checkForm(g, request).join("\n");

describe("each form, followed and not", () => {
  it.each([
    ["cronologia", chronology],
    ["misterio", mystery],
    ["contraste", contrast],
    ["despues", after],
  ] as const)("accepts a good %s", (form, beats) => {
    expect(checkForm(told(form, beats, [3, 6]), {})).toEqual([]);
  });

  it("every form starts with the hook and ends with the close", () => {
    const beats: VideoBeat[] = ["hecho", ...chronology.slice(1, -1), "hecho"];
    const found = errors(told("cronologia", beats));
    expect(found).toContain("scenes.0.beat");
    expect(found).toContain("«cierre»");
  });

  it("a role of another form is refused", () => {
    expect(errors(told("cronologia", [...chronology.slice(0, 3), "pista", "cierre"]))).toContain(
      "scenes.3.beat",
    );
  });

  it("misterio: no date on the first scene", () => {
    const g = told("misterio", mystery);
    g.scenes[0]?.graphics.push({ kind: "fecha" });
    expect(errors(g)).toContain("sin cartel de fecha");
  });

  it("misterio: the answer comes in the last third, after three clues", () => {
    const early: VideoBeat[] = ["gancho", "pista", "revelacion", ...times("pista", 6), "cierre"];
    const found = errors(told("misterio", early));
    expect(found).toContain("último tercio");
    expect(found).toContain("al menos 3 escenas «pista»; hay 1");
  });

  it("contraste: three of each side, alternating, and a verdict after them", () => {
    const flat: VideoBeat[] = ["gancho", "veredicto", ...times("ladoA", 5), "ladoB", "cierre"];
    const found = errors(told("contraste", flat));
    expect(found).toContain("«ladoB»; hay 1");
    expect(found).toContain("2 cambios de lado, hay 1");
    expect(found).toContain("«veredicto»");
  });

  it("despues: the event is told briefly and first", () => {
    const long: VideoBeat[] = ["gancho", ...times("hecho", 5), "despues", "hecho", "cierre"];
    const found = errors(told("despues", long));
    expect(found).toContain("4 escenas «hecho» como mucho");
    expect(found).toContain("antes de la primera «despues»");
    expect(found).toContain("«despues»; hay 1");
  });

  it("despues asks for name cards only from the Script office", () => {
    const g = told("despues", after);
    expect(errors(g, {})).toContain("cartel «nombre»");
    // the fact check may take a misleading card out
    expect(checkForm(g)).toEqual([]);
  });

  it("cronologia: mostly facts", () => {
    const thin: VideoBeat[] = ["gancho", ...times("pregunta", 5), "hecho", "cierre"];
    expect(errors(told("cronologia", thin))).toContain("«hecho»; hay 1");
  });
});

describe("which form", () => {
  const g = told("misterio", mystery);

  it("the chosen one, even if used lately", () => {
    expect(checkForm(g, { fixed: "misterio", avoid: ["misterio"] })).toEqual([]);
    expect(errors(g, { fixed: "contraste" })).toContain("tiene que ser «contraste»");
  });

  it("otherwise none of the latest", () => {
    expect(errors(g, { avoid: ["cronologia", "misterio"] })).toContain("ya se usó");
  });

  it("the Script office needs one; a script from before the forms does not", () => {
    const old = monaScript();
    const dossierText = compactDossier(monaDossier()).text;
    expect(checkScript(old, monaCandidates(), dossierText)).toEqual([]);
    expect(checkScript(old, monaCandidates(), dossierText, { form: {} }).join()).toContain(
      "falta la forma",
    );
    expect(aiScriptSchema.safeParse(old).success).toBe(false);
  });
});

describe("«tu aporte» inside a form", () => {
  const opinion = (beats: VideoBeat[], at: number): VideoBeat[] => [
    ...beats.slice(0, at),
    "aporte",
    ...beats.slice(at),
  ];

  it("fits every form", () => {
    for (const [form, beats] of [
      ["cronologia", chronology],
      ["misterio", mystery],
      ["contraste", contrast],
      ["despues", after],
    ] as const) {
      expect(checkForm(told(form, opinion(beats, beats.length - 1), [3, 6]), {})).toEqual([]);
    }
  });

  it("does not count in the proportions: it neither helps nor hurts", () => {
    // 6 of 10 scenes are facts: enough with the opinions left out of the count.
    const beats: VideoBeat[] = ["gancho", ...times("pregunta", 2), ...times("hecho", 6), "cierre"];
    expect(checkForm(told("cronologia", opinion(opinion(beats, 4), 5)))).toEqual([]);
    // An opinion before the answer does not push it into the last third.
    const early: VideoBeat[] = [
      "gancho",
      ...times("pista", 4),
      "aporte",
      "aporte",
      "revelacion",
      ...times("pista", 3),
      "cierre",
    ];
    expect(errors(told("misterio", early))).toContain("último tercio");
  });
});
