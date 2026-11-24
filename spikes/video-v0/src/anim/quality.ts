// Control de calidad del guion (V0-10, pedido del operador: "la próxima tiene que estar todo ok").
// Dos partes:
// - `normalizeGuion`: lo que el código arregla solo, sin pedirle otra vuelta a la IA (palabras no
//   rioplatenses, encuadres repetidos, objetos cortados contra el borde). Devuelve qué cambió.
// - `qualityErrors`: lo que no se puede arreglar solo y vuelve a la IA como error (escenas vacías
//   al arrancar, cajas que tapan personajes).
// En V1 esto es la oficina de Control de calidad, antes y después del render.
import type { GuionDraft, SceneDraft } from "./schema";

// --- Palabras -------------------------------------------------------------------------------

/** Palabras de España que salen a veces: se cambian por la rioplatense (salió "furgoneta" dos veces). */
const RIOPLATENSE: Record<string, string> = {
  furgoneta: "camioneta",
  furgonetas: "camionetas",
  coche: "auto",
  coches: "autos",
  ordenador: "computadora",
  ordenadores: "computadoras",
  conducir: "manejar",
  conducía: "manejaba",
  conducían: "manejaban",
  gafas: "anteojos",
  chaqueta: "campera",
  piscina: "pileta",
  aparcar: "estacionar",
  aparcó: "estacionó",
  patatas: "papas",
  zumo: "jugo",
};
const WORDS = new RegExp(`(?<![\\p{L}])(${Object.keys(RIOPLATENSE).join("|")})(?![\\p{L}])`, "giu");

function rioplatense(text: string): string {
  return text.replace(WORDS, (m) => {
    const to = RIOPLATENSE[m.toLowerCase()] ?? m;
    if (m === m.toUpperCase()) return to.toUpperCase();
    return m[0] === m[0]?.toUpperCase() ? to[0]?.toUpperCase() + to.slice(1) : to;
  });
}

/** Cambia las palabras en TODOS los textos (narración, titulares, cajas y palabras de enganche). */
function replaceDeep(value: unknown, changed: Set<string>): unknown {
  if (typeof value === "string") {
    const out = rioplatense(value);
    if (out !== value) {
      for (const m of value.match(WORDS) ?? []) changed.add(m.toLowerCase());
    }
    return out;
  }
  if (Array.isArray(value)) return value.map((v) => replaceDeep(v, changed));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, replaceDeep(v, changed)]));
  }
  return value;
}

// --- Cámara y encuadres -----------------------------------------------------------------------

/** Lo que muestra la cámara: el render usa zoom mínimo 1 y no sale del escenario (AnimVideo). */
export function view(cam: { zoom: number; x: number; y: number }) {
  const zoom = Math.max(1, cam.zoom);
  const hw = 540 / zoom;
  const hh = 960 / zoom;
  const cx = Math.min(1080 - hw, Math.max(hw, cam.x));
  const cy = Math.min(1920 - hh, Math.max(hh, cam.y));
  return { zoom, cx, cy, x0: cx - hw, x1: cx + hw, y0: cy - hh, y1: cy + hh };
}

const firstView = (s: SceneDraft) => view(s.camera[0] ?? { zoom: 1, x: 540, y: 960 });

/** Mismo lugar y casi el mismo encuadre (como lo ve el render). */
export function sameShot(a: SceneDraft, b: SceneDraft): boolean {
  const va = firstView(a);
  const vb = firstView(b);
  return (
    Math.abs(va.zoom - vb.zoom) < 0.3 &&
    Math.abs(va.cx - vb.cx) < 250 &&
    Math.abs(va.cy - vb.cy) < 250
  );
}

// --- Tamaño aproximado de cada objeto (en el escenario) -------------------------------------

type Box = { x0: number; x1: number; y0: number; y1: number };

function propBox(p: SceneDraft["props"][number]): Box | null {
  const s = "scale" in p ? (p.scale ?? 1) : 1;
  const at = (l: number, r: number, t: number, b: number, x: number, y: number) => ({
    x0: x + l * s,
    x1: x + r * s,
    y0: y + t * s,
    y1: y + b * s,
  });
  switch (p.kind) {
    case "calendar":
      return at(-150, 150, -160, 170, p.x, p.y);
    case "stopwatch":
      return at(-190, 190, -210, 190, p.x, p.y);
    case "question":
      return at(-100, 100, -150, 40, p.x, p.y);
    case "moneyBag":
      return at(-70, 70, -90, 70, p.x, p.y);
    case "phone":
      return at(-190, 190, -372, 372, p.x, p.y);
    case "book":
      return at(-130, 136, -180, 190, p.x, p.y);
    case "boat":
      return at(-230, 244, -120, 30, p.x, p.y);
    default:
      return null; // los del plano (ruta, marcas, cámaras) se dibujan sobre el plano fijo
  }
}

// --- Arreglos automáticos ---------------------------------------------------------------------

/**
 * Arregla lo que se puede sin la IA. Devuelve el guion nuevo y una línea por cada cambio (para el
 * informe). No toca nada que cambie el sentido.
 */
export function normalizeGuion(input: GuionDraft): { guion: GuionDraft; fixes: string[] } {
  const fixes: string[] = [];
  const changed = new Set<string>();
  const guion = replaceDeep(input, changed) as GuionDraft;
  if (changed.size > 0) {
    fixes.push(`palabras: ${[...changed].map((w) => `${w} → ${RIOPLATENSE[w] ?? w}`).join(", ")}`);
  }
  guion.scenes.forEach((s, i) => {
    // Encuadre repetido: se acerca (o se aleja) 0,4 la cámara de la segunda escena.
    const prev = guion.scenes[i - 1];
    if (prev && prev.setting === s.setting && sameShot(prev, s)) {
      const pz = firstView(prev).zoom;
      const target = pz <= 1.5 ? pz + 0.4 : pz - 0.4;
      const delta = target - Math.max(1, s.camera[0]?.zoom ?? 1);
      s.camera = s.camera.map((k) => ({
        ...k,
        zoom: Math.min(2, Math.max(1, Math.max(1, k.zoom) + delta)),
      }));
      fixes.push(`escena ${i + 1}: mismo encuadre que la anterior → zoom ${target.toFixed(1)}`);
    }
    // Objetos cortados: se meten dentro de lo que muestra la primera cámara (con 24 px de aire).
    const v = firstView(s);
    s.props = s.props.map((p, j) => {
      const b = propBox(p);
      if (!b || !("x" in p)) return p;
      const m = 24;
      const dx = b.x0 < v.x0 + m ? v.x0 + m - b.x0 : b.x1 > v.x1 - m ? v.x1 - m - b.x1 : 0;
      const dy = b.y0 < v.y0 + m ? v.y0 + m - b.y0 : b.y1 > v.y1 - m ? v.y1 - m - b.y1 : 0;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return p;
      fixes.push(`escena ${i + 1}: ${p.kind} (objeto ${j}) cortado por el borde → movido`);
      return { ...p, x: Math.round(p.x + dx), y: Math.round(p.y + dy) };
    });
  });
  return { guion, fixes };
}

// --- Errores que vuelven a la IA --------------------------------------------------------------

const norm = (w: string) =>
  w
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}%]/gu, "");

type CueLike = number | { word: string } | undefined;

/** ¿Pasa en el arranque? Segundo ≤ 0,8 o una de las 3 primeras palabras de la narración. */
function early(c: CueLike, first: string[]): boolean {
  if (c === undefined) return true;
  if (typeof c === "number") return c <= 0.8;
  return first.includes(norm(c.word));
}

/** Tamaño aproximado de una caja en pantalla (las cajas no se mueven con la cámara). */
function overlayBox(o: SceneDraft["overlays"][number]): Box {
  if (o.kind === "checklist") {
    return { x0: o.x, x1: o.x + 860, y0: o.y, y1: o.y + 110 * o.items.length };
  }
  if (o.kind === "dataBox") {
    const w = Math.max(o.text.length * 40, (o.sub?.length ?? 0) * 22) + 92;
    const h = o.sub ? 170 : 124;
    return { x0: o.x - w / 2, x1: o.x + w / 2, y0: o.y - h / 2, y1: o.y + h / 2 };
  }
  const w = o.text.length * 20 + 48;
  return { x0: o.x - w / 2, x1: o.x + w / 2, y0: o.y - 28, y1: o.y + 28 };
}

const area = (b: Box) => Math.max(0, b.x1 - b.x0) * Math.max(0, b.y1 - b.y0);
const overlap = (a: Box, b: Box) =>
  area({
    x0: Math.max(a.x0, b.x0),
    x1: Math.min(a.x1, b.x1),
    y0: Math.max(a.y0, b.y0),
    y1: Math.min(a.y1, b.y1),
  });

export function qualityErrors(guion: GuionDraft): string[] {
  const errors: string[] = [];
  guion.scenes.forEach((s, i) => {
    const where = `scenes.${i}`;
    // Nada de escenas vacías: en el fondo liso (`reloj-alarma`), algo en pantalla desde el
    // arranque. Los demás escenarios ya llenan el cuadro solos.
    const first = s.narration.split(/\s+/).slice(0, 3).map(norm);
    const something =
      s.actors.some((a) => early(a.enter, first)) ||
      s.props.some((p) => early(p.at, first)) ||
      s.overlays.some((o) => early(o.kind === "checklist" ? o.items[0]?.at : o.at, first));
    if (s.setting === "reloj-alarma" && !something) {
      errors.push(
        `${where} › arranca vacía: poné un personaje desde el principio, o un objeto o caja que entre en las 3 primeras palabras`,
      );
    }
    // Cajas que tapan la cara o el cuerpo de un personaje (con la primera cámara).
    const v = firstView(s);
    for (const [j, o] of s.overlays.entries()) {
      const box = overlayBox(o);
      if (box.x0 < 16 || box.x1 > 1064) {
        errors.push(`${where}.overlays.${j} › la caja se sale por el costado (x ${o.x})`);
      }
      for (const a of s.actors) {
        const k = a.scale ?? 1;
        const toScreen = (x: number, y: number) => ({
          x: (x - v.cx) * v.zoom + 540,
          y: (y - v.cy) * v.zoom + 960,
        });
        const top = toScreen(a.x - 55 * k, a.y - 300 * k);
        const mid = toScreen(a.x + 55 * k, a.y - 160 * k);
        const body = { x0: top.x, x1: mid.x, y0: top.y, y1: mid.y }; // cabeza y pecho
        if (area(body) > 0 && overlap(body, box) > 0.3 * area(body)) {
          errors.push(
            `${where}.overlays.${j} › la caja tapa la cara de "${a.who ?? a.id}": movela o corré al personaje`,
          );
        }
      }
    }
  });
  return errors;
}
