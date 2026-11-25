// Escenarios armados con piezas (ADR 0028): cada video arma sus propios escenarios con un kit de
// piezas dibujadas a mano (kit.tsx). Acá vive lo que no dibuja: la lista de piezas con su tamaño,
// el formato de un escenario (Zod), los controles y el texto que lee la IA. Sin React.
import { z } from "zod";
import type { NewPiece } from "./studio-format";

/** Colores con nombre: la IA elige un tono, el dibujo pone los tres matices. */
export const TONES = {
  azul: { base: "#2A3A66", dark: "#1A2546", light: "#4C64A6" },
  violeta: { base: "#3A3166", dark: "#262049", light: "#6C639F" },
  verde: { base: "#23463D", dark: "#16302A", light: "#3F7A66" },
  bordo: { base: "#4A2230", dark: "#311521", light: "#7A3A4E" },
  gris: { base: "#3A4052", dark: "#262B39", light: "#5E6680" },
  arena: { base: "#6B5A45", dark: "#4A3D2F", light: "#A08A6C" },
  madera: { base: "#7A5A3E", dark: "#553D29", light: "#A57E58" },
} as const;
export type Tone = keyof typeof TONES;
const toneSchema = z.enum(Object.keys(TONES) as [Tone, ...Tone[]]);

export const FLOORS = {
  baldosas: "interior",
  alfombra: "interior",
  madera: "interior",
  tecnico: "interior",
  cemento: "interior",
  pasto: "exterior",
  vereda: "exterior",
  calle: "exterior",
  tierra: "exterior",
} as const;
export type Floor = keyof typeof FLOORS;

/** La línea del piso de todos los escenarios armados: los personajes pisan en y ≈ 1330. */
export const FLOOR_Y = 1340;

type PieceInfo = {
  /** Ancho y alto a scale 1, en px del escenario (1080 × 1920). */
  w: number;
  h: number;
  /** Orden de dibujo: el fondo primero, el ambiente al final (delante de todo menos personajes). */
  layer: "techo" | "fondo" | "mueble" | "sobre" | "ambiente";
  /** Para lo que se apoya encima (`on`): a qué altura de la base está la superficie. */
  surface?: number;
  /** Dónde va (para la IA). */
  where: string;
  /** Qué es y qué se mueve. */
  what: string;
};

/** El kit. Para sumar una pieza: dibujarla en kit.tsx y agregarla acá (el texto de la IA sale solo). */
export const PIECES = {
  // Techo: la base va arriba (y ≈ 40–320); no tapan nada importante.
  "luz-techo": {
    w: 300,
    h: 30,
    layer: "techo",
    where: "techo, y ≈ 60",
    what: "panel de luz con resplandor; uno puede temblar",
  },
  lampara: {
    w: 160,
    h: 320,
    layer: "techo",
    where: "techo, y ≈ 320",
    what: "lámpara colgante que se mece, con cono de luz hasta el piso",
  },
  // Pared y fondo.
  ventanal: {
    w: 700,
    h: 440,
    layer: "fondo",
    where: "pared, y ≈ 1000",
    what: 'ventanal grande: ciudad (o cielo y cerros si `outside: "campo"`) según la hora; ventanas que titilan, nubes o estrellas',
  },
  ventana: {
    w: 260,
    h: 320,
    layer: "fondo",
    where: "pared, y ≈ 980",
    what: "ventana chica con cielo según la hora",
  },
  puerta: {
    w: 220,
    h: 400,
    layer: "fondo",
    where: "piso, y = 1340",
    what: "puerta con picaporte y luz por debajo",
  },
  columna: { w: 90, h: 800, layer: "fondo", where: "piso, y = 1340", what: "columna clásica" },
  cuadro: {
    w: 200,
    h: 150,
    layer: "fondo",
    where: "pared, y ≈ 900",
    what: "cuadro con paisaje abstracto",
  },
  reloj: {
    w: 180,
    h: 180,
    layer: "fondo",
    where: "pared, y ≈ 860",
    what: "reloj de pared con agujas que se mueven",
  },
  pizarra: {
    w: 300,
    h: 340,
    layer: "fondo",
    where: "pared, y ≈ 980",
    what: "pizarra con notas de colores y flechas (sin texto)",
  },
  pantalla: {
    w: 440,
    h: 270,
    layer: "fondo",
    where: "pared, y ≈ 960",
    what: 'TV o pantalla de pared con un gráfico de línea que se dibuja (sube, o baja con `variant: "baja"`)',
  },
  estante: {
    w: 360,
    h: 440,
    layer: "fondo",
    where: "piso, y = 1340",
    what: "estantería con cajas y carpetas de colores",
  },
  cartel: {
    w: 320,
    h: 130,
    layer: "fondo",
    where: "pared, y ≈ 760",
    what: "cartel luminoso sin texto (una flecha de neón que titila)",
  },
  // Exterior (con `kind: "exterior"`).
  ciudad: {
    w: 1080,
    h: 460,
    layer: "fondo",
    where: "horizonte, y ≈ 1100–1340",
    what: "edificios a lo lejos con ventanas que titilan",
  },
  cerros: {
    w: 1080,
    h: 420,
    layer: "fondo",
    where: "horizonte, y ≈ 1200–1340",
    what: "cerros en capas",
  },
  edificio: {
    w: 380,
    h: 720,
    layer: "fondo",
    where: "piso, y = 1340",
    what: 'edificio con ventanas que se prenden y apagan; con `variant: "banco"`, frente de banco con columnas',
  },
  arbol: { w: 220, h: 380, layer: "mueble", where: "piso, y = 1340", what: "árbol que se mece" },
  farol: {
    w: 80,
    h: 440,
    layer: "mueble",
    where: "piso, y = 1340",
    what: "farol de calle con luz",
  },
  auto: {
    w: 380,
    h: 160,
    layer: "mueble",
    where: "piso, y ≈ 1400–1500 (sobre la calle)",
    what: "auto estacionado",
  },
  // Muebles (en el piso). Las superficies sirven para apoyar cosas con `on`.
  escritorio: {
    w: 620,
    h: 270,
    layer: "mueble",
    surface: 270,
    where: "piso, y = 1340",
    what: "escritorio con cajones",
  },
  mesa: { w: 440, h: 230, layer: "mueble", surface: 230, where: "piso, y = 1340", what: "mesa" },
  mostrador: {
    w: 900,
    h: 330,
    layer: "mueble",
    surface: 330,
    where: "piso, y = 1340",
    what: "mostrador largo de atención (banco, negocio, recepción)",
  },
  archivero: {
    w: 180,
    h: 300,
    layer: "mueble",
    surface: 300,
    where: "piso, y = 1340",
    what: "mueble archivero de metal",
  },
  silla: { w: 150, h: 240, layer: "mueble", where: "piso, y = 1340", what: "silla de oficina" },
  sillon: { w: 380, h: 220, layer: "mueble", where: "piso, y = 1340", what: "sillón de living" },
  cajas: {
    w: 260,
    h: 250,
    layer: "mueble",
    where: "piso, y = 1340",
    what: "pila de cajas de cartón",
  },
  "caja-fuerte": {
    w: 260,
    h: 300,
    layer: "mueble",
    where: "piso, y = 1340",
    what: "caja fuerte con dial que gira",
  },
  rack: {
    w: 164,
    h: 780,
    layer: "mueble",
    where: "piso, y = 1340",
    what: "rack de servidores con luces que titilan (ponelos de a varios, pegados: x cada 170)",
  },
  planta: {
    w: 150,
    h: 280,
    layer: "mueble",
    where: "piso, y = 1340",
    what: "planta en maceta que se mece",
  },
  // Sobre los muebles (con `on`).
  monitor: {
    w: 320,
    h: 250,
    layer: "sobre",
    where: "sobre un mueble (`on`)",
    what: "monitor con código que sube y cursor que titila",
  },
  notebook: {
    w: 260,
    h: 160,
    layer: "sobre",
    where: "sobre un mueble (`on`)",
    what: "notebook abierta con la pantalla encendida",
  },
  "lampara-escritorio": {
    w: 140,
    h: 200,
    layer: "sobre",
    where: "sobre un mueble (`on`)",
    what: "lámpara de escritorio con luz",
  },
  taza: { w: 70, h: 60, layer: "sobre", where: "sobre un mueble (`on`)", what: "taza con vapor" },
  libros: {
    w: 170,
    h: 90,
    layer: "sobre",
    where: "sobre un mueble (`on`)",
    what: "pila de libros",
  },
  "planta-chica": {
    w: 90,
    h: 120,
    layer: "sobre",
    where: "sobre un mueble (`on`)",
    what: "plantita en maceta",
  },
  telefono: {
    w: 140,
    h: 80,
    layer: "sobre",
    where: "sobre un mueble (`on`)",
    what: "teléfono fijo con luz que titila",
  },
  // Ambiente: ocupan todo el cuadro; `x` solo cuenta para el haz de luz.
  "haz-luz": {
    w: 600,
    h: 1340,
    layer: "ambiente",
    where: "x = de dónde cae",
    what: "haz de luz desde arriba con polvo flotando",
  },
  polvo: {
    w: 1080,
    h: 1920,
    layer: "ambiente",
    where: "todo el cuadro",
    what: "partículas de polvo flotando",
  },
  niebla: {
    w: 1080,
    h: 300,
    layer: "ambiente",
    where: "sobre el piso",
    what: "niebla o aire frío que corre por el piso",
  },
  lluvia: {
    w: 1080,
    h: 1920,
    layer: "ambiente",
    where: "todo el cuadro",
    what: "lluvia (mejor afuera o detrás de un ventanal de noche)",
  },
} as const satisfies Record<string, PieceInfo>;
export type PieceKind = keyof typeof PIECES;

export const pieceSchema = z
  .object({
    kind: z
      .string()
      .regex(/^[a-z0-9-]{3,30}$/)
      .describe("Una pieza del kit (lista al final) o una nueva declarada en `newPieces`."),
    x: z.number().min(-200).max(1280).describe("Centro de la base de la pieza."),
    y: z
      .number()
      .min(0)
      .max(1920)
      .optional()
      .describe(
        "Base de la pieza. Sin `y`: la del catálogo (piso, pared o techo). Con `on`, no va.",
      ),
    on: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe(
        "Índice (desde 0) de la pieza de `pieces` sobre la que se apoya (escritorio, mesa…).",
      ),
    scale: z.number().min(0.5).max(1.8).optional(),
    flip: z.boolean().optional().describe("Espejada (mira para el otro lado)."),
    tone: toneSchema.optional().describe("Color de la pieza (muebles, autos, edificios)."),
    variant: z
      .string()
      .max(20)
      .optional()
      .describe("Solo las piezas que lo dicen (pantalla, edificio, ventanal)."),
  })
  .strict();
export type Piece = z.infer<typeof pieceSchema>;

export const setSchema = z
  .object({
    id: z
      .string()
      .regex(/^[a-z0-9-]{3,30}$/)
      .describe(
        "Nombre corto en minúsculas y guiones (oficina-aws, sala-servidores). Las escenas lo usan en `setting`.",
      ),
    kind: z.enum(["interior", "exterior"]),
    light: z.enum(["dia", "atardecer", "noche"]),
    wall: toneSchema.describe(
      "Interior: color de la pared. Exterior: se ignora (cielo según la hora).",
    ),
    floor: z.enum(Object.keys(FLOORS) as [Floor, ...Floor[]]),
    pieces: z.array(pieceSchema).min(3).max(16),
  })
  .strict();
export type SetSpec = z.infer<typeof setSchema>;

/** Una pieza lista para dibujar: con su `y` resuelta (catálogo, explícita o apoyada en otra). */
export type PlacedPiece = Piece & { y: number; scale: number; index: number };

const DEFAULT_Y: Partial<Record<PieceKind, number>> = {
  "luz-techo": 60,
  lampara: 320,
  ventanal: 1000,
  ventana: 980,
  cuadro: 900,
  reloj: 860,
  pizarra: 980,
  pantalla: 960,
  cartel: 760,
  ciudad: FLOOR_Y,
  cerros: FLOOR_Y,
  auto: 1440,
};

/** Piezas que no están dibujadas a mano: las del Estudio y las que pide el guion (`newPieces`). */
export type ExtraPieces = Record<string, NewPiece>;
const LAYER_OF: Record<NewPiece["where"], PieceInfo["layer"]> = {
  piso: "mueble",
  pared: "fondo",
  techo: "techo",
  sobre: "sobre",
};
const EXTRA_Y: Record<NewPiece["where"], number> = {
  piso: FLOOR_Y,
  pared: 960,
  techo: 60,
  sobre: FLOOR_Y,
};

/** Tamaño, capa y superficie de una pieza del kit o del Estudio (undefined si no existe). */
export function pieceInfo(kind: string, extra: ExtraPieces = {}): PieceInfo | undefined {
  if (kind in PIECES) return PIECES[kind as PieceKind];
  const n = extra[kind];
  if (!n) return undefined;
  return {
    w: n.w,
    h: n.h,
    layer: LAYER_OF[n.where],
    surface: n.surface,
    where: n.where,
    what: n.what,
  };
}

/** Resuelve la `y` de cada pieza y las ordena para dibujar (por capa y, dentro, como vinieron). */
export function placePieces(spec: SetSpec, extra: ExtraPieces = {}): PlacedPiece[] {
  const placed: PlacedPiece[] = [];
  spec.pieces.forEach((p, index) => {
    const scale = p.scale ?? 1;
    const n = extra[p.kind];
    // Una pieza nueva de techo cuelga desde arriba: su base queda a su alto del techo.
    const extraY = n ? (n.where === "techo" ? 40 + n.h * scale : EXTRA_Y[n.where]) : FLOOR_Y;
    let y = p.y ?? DEFAULT_Y[p.kind as PieceKind] ?? extraY;
    const base = p.on !== undefined ? placed[p.on] : undefined;
    if (base) {
      const surface = pieceInfo(base.kind, extra)?.surface;
      if (surface !== undefined) y = base.y - surface * base.scale;
    }
    placed.push({ ...p, y, scale, index });
  });
  const order = ["techo", "fondo", "mueble", "sobre", "ambiente"];
  return [...placed].sort(
    (a, b) =>
      order.indexOf(pieceInfo(a.kind, extra)?.layer ?? "mueble") -
        order.indexOf(pieceInfo(b.kind, extra)?.layer ?? "mueble") || a.index - b.index,
  );
}

/** Errores de sentido de un escenario (vacío = bien). */
export function checkSet(spec: SetSpec, where: string, extra: ExtraPieces = {}): string[] {
  const errors: string[] = [];
  const outdoor = spec.kind === "exterior";
  if ((FLOORS[spec.floor] === "exterior") !== outdoor) {
    errors.push(`${where}floor › "${spec.floor}" no va en un escenario ${spec.kind}`);
  }
  spec.pieces.forEach((p, i) => {
    const at = `${where}pieces.${i}`;
    const info = pieceInfo(p.kind, extra);
    if (!info) {
      errors.push(
        `${at}.kind › "${p.kind}" no está en el kit: usá una pieza de la lista o declarala en \`newPieces\` para que la dibuje el Estudio`,
      );
      return;
    }
    if (p.on !== undefined) {
      const base = spec.pieces[p.on];
      if (p.on >= i || !base) {
        errors.push(`${at}.on › tiene que apuntar a una pieza ANTERIOR de la lista`);
      } else if (pieceInfo(base.kind, extra)?.surface === undefined) {
        errors.push(`${at}.on › "${base.kind}" no tiene superficie para apoyar cosas`);
      }
      if (p.y !== undefined) errors.push(`${at} › con \`on\` no va \`y\``);
    } else if (info.layer === "sobre") {
      errors.push(`${at} › "${p.kind}" va apoyado sobre un mueble: poné \`on\``);
    }
    if (info.layer !== "ambiente" && info.w < 1000) {
      const half = (info.w * (p.scale ?? 1)) / 2;
      if (p.x + half < 60 || p.x - half > 1020)
        errors.push(`${at}.x › ${p.x}: queda fuera del cuadro`);
    }
  });
  return errors;
}

/** La parte del prompt que explica el kit; sale de PIECES, así nunca queda desactualizada. */
export function kitDoc(studio: NewPiece[] = []): string {
  const rows = Object.entries(PIECES).map(
    ([k, v]) => `- \`${k}\` (${v.w}×${v.h}): ${v.what}. ${v.where}.`,
  );
  const extra = studio.map(
    (n) =>
      `- \`${n.kind}\` (${n.w}×${n.h}): ${n.what}. ${n.where === "sobre" ? "sobre un mueble (`on`)" : n.where}. (del Estudio)`,
  );
  return [
    "## Piezas del kit (para `sets`)",
    "",
    `Tonos (\`wall\`, \`tone\`): ${Object.keys(TONES).join(", ")}. Pisos: interior ${Object.entries(
      FLOORS,
    )
      .filter(([, v]) => v === "interior")
      .map(([k]) => k)
      .join(", ")}; exterior ${Object.entries(FLOORS)
      .filter(([, v]) => v === "exterior")
      .map(([k]) => k)
      .join(", ")}.`,
    "",
    ...rows,
    ...extra,
  ].join("\n");
}
