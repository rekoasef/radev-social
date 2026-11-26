import {
  clock,
  type Dossier,
  type Graphic,
  type ImagesDoc,
  narrationWords,
  numbersIn,
  type Review,
  type Script,
  type SourceResult,
  type SourcesDoc,
  smallImagePath,
  usableDossier,
} from "@radev/video";

// What the script desk shows, from the video's documents. Pure.

/** The narrator reads about this many characters a second (measured with real takes). */
const CHARS_PER_SECOND = 14;
/** The share of a fact's words a scene must say for the fact to be placed on it. */
const FACT_MATCH = 0.34;

export type Piece = { text: string; changed: boolean };

export type FactView = {
  /** The dossier's id (F1, C2…). */
  id: string;
  claim: string;
  url: string | null;
  /** How much of it is on its page (the Sources office); null without data. */
  result: SourceResult | null;
  /** The sentence of its page that backs it, when the Sources office found it. */
  quote: string | null;
  /** What the claim says and its page does not (backed only in part). */
  differs: string | null;
  /** Its page does not say it: Script and Verification did not get it. */
  dropped: boolean;
};

export type ImageView = {
  id: string;
  title: string;
  author: string;
  license: string;
  page: string;
  src: string;
};

export type SceneView = {
  n: number;
  /** "0:12", estimated until there is a voice. */
  start: string;
  seconds: number;
  narration: string;
  caption: string;
  image: ImageView | null;
  /** The other scenes that use the same image. */
  repeated: number[];
  graphics: string[];
  facts: FactView[];
  fix: { problem: string; before: Piece[]; after: Piece[] } | null;
  unverified: boolean;
  /** The scene as it will come out (null: not drawn yet, or the scene changed since). */
  frames: { short: string | null; normal: string | null } | null;
};

export type ScriptDeskView = {
  title: string;
  scenes: SceneView[];
  facts: (FactView & { scene: number | null })[];
  images: ImageView[];
  characters: number;
  seconds: number;
  imagesUsed: number;
  notes: { tone: "cued" | "ready"; text: string }[];
  /** Scenes whose frame is still to be drawn. */
  framesPending: number;
};

/** The two texts word by word, marking what each does not share with the other (LCS). */
export function diffWords(before: string, after: string): { before: Piece[]; after: Piece[] } {
  const a = before.split(/\s+/).filter(Boolean);
  const b = after.split(/\s+/).filter(Boolean);
  const length = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  const at = (i: number, j: number) => length[i]?.[j] ?? 0;
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      const row = length[i] as number[];
      row[j] = a[i] === b[j] ? at(i + 1, j + 1) + 1 : Math.max(at(i + 1, j), at(i, j + 1));
    }
  }
  const keptA = new Set<number>();
  const keptB = new Set<number>();
  for (let i = 0, j = 0; i < a.length && j < b.length; ) {
    if (a[i] === b[j]) {
      keptA.add(i++);
      keptB.add(j++);
    } else if (at(i + 1, j) >= at(i, j + 1)) i++;
    else j++;
  }
  const join = (words: string[], kept: Set<number>) =>
    words.reduce<Piece[]>((pieces, word, i) => {
      const changed = !kept.has(i);
      const last = pieces.at(-1);
      if (last && last.changed === changed) last.text += ` ${word}`;
      else pieces.push({ text: word, changed });
      return pieces;
    }, []);
  return { before: join(a, keptA), after: join(b, keptB) };
}

/** Words worth comparing, cut to their start so "descubierto" matches "descubrió". */
const stems = (text: string) =>
  new Set(
    narrationWords(text)
      .filter((w) => w.length > 3)
      .map((w) => w.slice(0, 5)),
  );

/** The scene (from 0) that says a fact, or null. The script does not record it, so: by its words. */
export function sceneOfFact(claim: string, narrations: readonly string[]): number | null {
  const words = stems(claim);
  const numbers = numbersIn(claim);
  let best: { index: number; score: number } | null = null;
  for (const [index, narration] of narrations.entries()) {
    const said = stems(narration);
    const saidNumbers = new Set(numbersIn(narration));
    const shared = [...words].filter((w) => said.has(w)).length;
    const sharedNumbers = numbers.filter((n) => saidNumbers.has(n)).length;
    const score = (shared + sharedNumbers) / Math.max(1, words.size + numbers.length);
    if (score >= FACT_MATCH && (!best || score > best.score)) best = { index, score };
  }
  return best?.index ?? null;
}

const GRAPHIC_LABEL: Record<Graphic["kind"], (g: Graphic) => string> = {
  fecha: (g) => (g.kind === "fecha" ? `Fecha · ${g.text}` : ""),
  cifra: (g) => (g.kind === "cifra" ? `Cifra · ${g.value}${g.unit ? ` ${g.unit}` : ""}` : ""),
  nombre: (g) => (g.kind === "nombre" ? `Nombre · ${g.name}` : ""),
  cronologia: () => "Cronología",
  cita: () => "Cita",
};

export const unverifiedResult = (result: SourceResult | null) =>
  result === "no-esta" || result === "sin-pagina";

export function scriptDesk(input: {
  videoId: string;
  script: Script;
  images: ImagesDoc;
  dossier: Dossier;
  sources: SourcesDoc | null;
  review: {
    applied: Review["fixes"];
    rejected: unknown[];
    frames?:
      | { status: "done"; frames: number; applied: number }
      | { status: "skipped"; reason: string };
  } | null;
  /** The script before the fact check changed it, for the corrections. */
  beforeReview: Script | null;
  frames?: ReadonlyMap<number, { short: string | null; normal: string | null }>;
}): ScriptDeskView {
  const { script, dossier } = input;
  const images: ImageView[] = input.images.candidates.map((c) => ({
    id: c.id,
    title: c.title,
    author: c.author,
    license: c.license,
    page: c.page,
    src: `/media/videos/${input.videoId}/${smallImagePath(c.id)}`,
  }));
  const imageById = new Map(images.map((i) => [i.id, i]));
  const results = new Map(input.sources?.facts.map((f) => [f.id, f.result]));
  const quotes = new Map(input.sources?.facts.map((f) => [f.id, f.quote ?? null]));
  const differs = new Map(input.sources?.facts.map((f) => [f.id, f.differs ?? null]));
  const dropped = new Set(usableDossier(dossier, input.sources).dropped);
  const narrations = script.scenes.map((s) => s.narration);

  const facts = script.facts.map(({ claim, source }) => {
    const id = source.match(/\b[FC]\d{1,2}\b/)?.[0] ?? source;
    const origin =
      dossier.facts.find((f) => f.id === id) ?? dossier.quotes.find((q) => q.id === id);
    return {
      id,
      claim,
      url: origin?.url ?? null,
      result: results.get(id) ?? null,
      quote: quotes.get(id) ?? null,
      differs: differs.get(id) ?? null,
      dropped: dropped.has(id),
      scene: sceneOfFact(claim, narrations),
    };
  });

  const uses = new Map<string, number[]>();
  for (const [i, s] of script.scenes.entries()) {
    uses.set(s.image, [...(uses.get(s.image) ?? []), i + 1]);
  }

  let elapsed = 0;
  const scenes: SceneView[] = script.scenes.map((s, i) => {
    const n = i + 1;
    const seconds = s.narration.length / CHARS_PER_SECOND + (s.tail ?? 0);
    const start = clock(elapsed);
    elapsed += seconds;
    const applied = input.review?.applied.filter((f) => f.scene === n) ?? [];
    const old = input.beforeReview?.scenes[i];
    const narrationFix = applied.find((f) => f.narration);
    const mine = facts.filter((f) => f.scene === i);
    return {
      n,
      start,
      seconds,
      narration: s.narration,
      caption: s.caption ?? "",
      image: imageById.get(s.image) ?? null,
      repeated: (uses.get(s.image) ?? []).filter((other) => other !== n),
      graphics: s.graphics.map((g) => GRAPHIC_LABEL[g.kind](g)),
      facts: mine,
      fix: applied.length
        ? {
            problem: applied.map((f) => f.problem).join(" "),
            ...(narrationFix?.narration && old
              ? diffWords(old.narration, narrationFix.narration)
              : { before: [], after: [] }),
          }
        : null,
      unverified: mine.some((f) => unverifiedResult(f.result)),
      frames: input.frames?.get(n) ?? null,
    };
  });

  const characters = narrations.reduce((n, t) => n + t.length, 0);
  const repeated = [...uses.values()].filter((v) => v.length > 1);
  const notes: ScriptDeskView["notes"] = [];
  if (dropped.size) {
    notes.push({
      tone: "cued",
      text: `${dropped.size} hechos o citas no están en su página (la leyó una IA y el código lo comprobó): Guion y Verificación no los usaron.`,
    });
  }
  const unread = facts.filter((f) => unverifiedResult(f.result) && !dropped.has(f.id)).length;
  if (unread) {
    notes.push({
      tone: "cued",
      text: `${unread} hechos sin comprobar en su página (no se pudo leer, o no se buscaron): mirá los que importan.`,
    });
  }
  if (repeated.length) {
    notes.push({
      tone: "cued",
      text: `Imágenes repetidas en las escenas ${repeated.map((v) => v.join(" y ")).join(", ")}.`,
    });
  }
  if (input.review) {
    notes.push({
      tone: "ready",
      text: `Verificación: ${input.review.applied.length} correcciones aplicadas, ${input.review.rejected.length} rechazadas.`,
    });
  }

  const look = input.review?.frames;
  if (look?.status === "done") {
    notes.push({
      tone: "ready",
      text: `Cuadros mirados por la IA: ${look.frames / 2} escenas en los dos formatos, ${look.applied} corregidas.`,
    });
  } else if (look?.status === "skipped") {
    notes.push({ tone: "cued", text: `No se miraron los cuadros: ${look.reason}` });
  }
  const pending = scenes.filter((s) => !s.frames?.short || !s.frames.normal).length;
  if (input.frames && pending > 0) {
    notes.push({
      tone: "cued",
      text: `${pending === 1 ? "1 escena" : `${pending} escenas`} sin su cuadro dibujado: se ve la foto entera, no cómo sale.`,
    });
  }

  return {
    framesPending: input.frames ? pending : 0,
    title: script.title,
    scenes,
    facts: facts.map((f) => ({ ...f, scene: f.scene === null ? null : f.scene + 1 })),
    images,
    characters,
    seconds: Math.round(elapsed),
    imagesUsed: uses.size,
    notes,
  };
}
