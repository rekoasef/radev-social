// Estudio (ADR 0028): piezas del kit dibujadas por la IA. No son código: son datos (formas simples,
// colores de la paleta y movimientos predefinidos) que se validan con Zod, se controlan acá y se
// dibujan con studio-draw.tsx. El operador las aprueba antes de que entren al kit. Sin React.
import { z } from "zod";

/** La paleta de las piezas: los mismos colores que el resto de los dibujos, con nombre. */
export const PALETTE = {
  tinta: "#141A2C",
  noche: "#1A2546",
  pizarra: "#2B3550",
  gris: "#5E6680",
  "gris-claro": "#9AA3BF",
  blanco: "#E9EEF7",
  violeta: "#6C639F",
  lila: "#C3B8F0",
  azul: "#2E5BDA",
  celeste: "#8EC7FF",
  turquesa: "#7FD1B9",
  verde: "#4E9F6E",
  "verde-oscuro": "#2F6B45",
  amarillo: "#F2C14E",
  crema: "#FFE3A8",
  naranja: "#E8833A",
  rojo: "#E5383B",
  rosa: "#F4978E",
  bordo: "#7A3A4E",
  marron: "#7A5A3E",
  "marron-oscuro": "#553D29",
  madera: "#A57E58",
  carton: "#B08356",
  piedra: "#8A8598",
} as const;
export type PaletteColor = keyof typeof PALETTE;
const color = z.enum(Object.keys(PALETTE) as [PaletteColor, ...PaletteColor[]]);

const num = z.number().min(-2000).max(2000);
const paint = {
  fill: color.or(z.literal("none")),
  stroke: color.optional(),
  strokeWidth: z.number().min(1).max(40).optional(),
  opacity: z.number().min(0.05).max(1).optional(),
  group: z
    .string()
    .max(20)
    .optional()
    .describe("Id de un grupo de `groups` (para moverse juntos)."),
};

/** `d` solo con comandos absolutos (mayúsculas): así el código puede controlar los límites. */
const pathD = z
  .string()
  .max(700)
  .regex(/^[MLHVCQSTAZ0-9 .,-]+$/, "solo comandos absolutos (M L H V C Q S T A Z) y números");

export const shapeSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("rect"),
      x: num,
      y: num,
      w: z.number().min(1).max(2000),
      h: z.number().min(1).max(2000),
      r: z.number().min(0).max(200).optional(),
      ...paint,
    })
    .strict(),
  z
    .object({
      type: z.literal("circle"),
      cx: num,
      cy: num,
      r: z.number().min(1).max(1000),
      ...paint,
    })
    .strict(),
  z
    .object({
      type: z.literal("ellipse"),
      cx: num,
      cy: num,
      rx: z.number().min(1).max(1000),
      ry: z.number().min(1).max(1000),
      ...paint,
    })
    .strict(),
  z.object({ type: z.literal("path"), d: pathD, ...paint }).strict(),
]);
export type Shape = z.infer<typeof shapeSchema>;

export const MOTIONS = ["mecer", "flotar", "titilar", "girar", "latir", "deslizar"] as const;

export const groupSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]{1,20}$/),
    motion: z
      .enum(MOTIONS)
      .describe(
        "mecer: gira ±amount grados alrededor del pivote · flotar: sube y baja amount px · titilar: la opacidad baja hasta amount (0–1) · girar: vueltas completas alrededor del pivote · latir: crece y achica ±amount (0,02–0,2) · deslizar: va y viene amount px en x",
      ),
    speed: z.number().min(0.05).max(3).describe("Ciclos por segundo (0,1–0,5 suave; 1–3 rápido)."),
    amount: z.number().min(0).max(200),
    pivotX: num.optional(),
    pivotY: num.optional(),
  })
  .strict();

export const WHERE = ["piso", "pared", "techo", "sobre"] as const;

/** Lo que el guion pide cuando le falta una pieza (y ya usa en `sets`). */
export const newPieceSchema = z
  .object({
    kind: z
      .string()
      .regex(/^[a-z0-9-]{3,30}$/)
      .describe("Nombre de la pieza nueva, como las del kit (ovni, vitrina-carniceria)."),
    what: z.string().min(10).max(300).describe("Cómo es y qué se mueve, para quien la dibuja."),
    where: z
      .enum(WHERE)
      .describe(
        "piso: apoyada en el piso · pared · techo · sobre: encima de un mueble (con `on`).",
      ),
    w: z.number().min(40).max(1080),
    h: z.number().min(40).max(1300),
    surface: z
      .number()
      .min(10)
      .max(1300)
      .optional()
      .describe("Si se le pueden apoyar cosas encima: a qué altura."),
  })
  .strict();
export type NewPiece = z.infer<typeof newPieceSchema>;

/** Una pieza dibujada: lo pedido más el dibujo. La base está en (0, 0) y sube en negativo. */
export const studioPieceSchema = z
  .object({
    shapes: z
      .array(shapeSchema)
      .min(4)
      .max(70)
      .describe("En orden de dibujo: lo de atrás primero."),
    groups: z.array(groupSchema).max(6).optional(),
  })
  .strict();
export type StudioDrawing = z.infer<typeof studioPieceSchema>;
export type StudioPiece = NewPiece & StudioDrawing;

/** Puntos (x, y) de un `d` absoluto, para controlar los límites. */
function pathPoints(d: string): [number, number][] {
  const tokens = d.match(/[A-Z]|-?\d*\.?\d+/g) ?? [];
  const arity: Record<string, number> = {
    M: 2,
    L: 2,
    T: 2,
    H: 1,
    V: 1,
    C: 6,
    S: 4,
    Q: 4,
    A: 7,
    Z: 0,
  };
  const points: [number, number][] = [];
  let cmd = "M";
  let x = 0;
  let y = 0;
  for (let i = 0; i < tokens.length; ) {
    const tok = tokens[i] ?? "";
    if (/[A-Z]/.test(tok)) {
      cmd = tok;
      i++;
      if (cmd === "Z") continue;
    }
    const n = arity[cmd] ?? 2;
    const args = tokens.slice(i, i + n).map(Number);
    if (args.length < n || args.some(Number.isNaN)) break;
    i += n;
    if (cmd === "H") x = args[0] ?? x;
    else if (cmd === "V") y = args[0] ?? y;
    else if (cmd === "A") {
      x = args[5] ?? x;
      y = args[6] ?? y;
    } else {
      for (let k = 0; k < n; k += 2) points.push([args[k] ?? 0, args[k + 1] ?? 0]);
      x = args[n - 2] ?? x;
      y = args[n - 1] ?? y;
      continue;
    }
    points.push([x, y]);
  }
  return points;
}

/** Errores de sentido de un dibujo (vacío = bien): límites, grupos y que tenga algo vivo. */
export function checkStudioPiece(spec: NewPiece, drawing: StudioDrawing): string[] {
  const errors: string[] = [];
  const mx = spec.w * 0.55;
  const top = -spec.h * 1.08;
  const bottom = spec.h * 0.04;
  const inside = (x: number, y: number) => x >= -mx && x <= mx && y >= top && y <= bottom;
  const groups = new Set((drawing.groups ?? []).map((g) => g.id));
  drawing.shapes.forEach((s, i) => {
    const at = `shapes.${i}`;
    if (s.group && !groups.has(s.group))
      errors.push(`${at}.group › "${s.group}" no está en \`groups\``);
    const corners: [number, number][] =
      s.type === "rect"
        ? [
            [s.x, s.y],
            [s.x + s.w, s.y + s.h],
          ]
        : s.type === "circle"
          ? [
              [s.cx - s.r, s.cy - s.r],
              [s.cx + s.r, s.cy + s.r],
            ]
          : s.type === "ellipse"
            ? [
                [s.cx - s.rx, s.cy - s.ry],
                [s.cx + s.rx, s.cy + s.ry],
              ]
            : pathPoints(s.d);
    const out = corners.find(([x, y]) => !inside(x, y));
    if (out) {
      errors.push(
        `${at} › el punto (${out[0]}, ${out[1]}) queda fuera de la pieza: x entre ${-spec.w / 2} y ${spec.w / 2}, y entre ${-spec.h} y 0`,
      );
    }
    if (s.fill === "none" && !s.stroke) errors.push(`${at} › sin relleno ni borde no se ve`);
  });
  if ((drawing.groups ?? []).length === 0) {
    errors.push("groups › falta algo que se mueva (al menos un grupo con movimiento)");
  } else if (!drawing.shapes.some((s) => s.group)) {
    errors.push("groups › ningún dibujo usa los grupos: poné `group` en las formas que se mueven");
  }
  const big = drawing.shapes.filter((s) => s.type !== "path" || s.d.length > 20).length;
  if (big < 4) errors.push("shapes › muy pocas formas para que se entienda qué es");
  return errors;
}

/** Ejemplos para quien dibuja: dos piezas del kit pasadas a este formato. */
export const DRAWING_EXAMPLES: Record<string, StudioPiece> = {
  "caja-fuerte": {
    kind: "caja-fuerte",
    what: "caja fuerte con dial que gira",
    where: "piso",
    w: 260,
    h: 300,
    shapes: [
      { type: "rect", x: -130, y: -300, w: 260, h: 290, r: 14, fill: "tinta" },
      { type: "rect", x: -110, y: -280, w: 220, h: 250, r: 10, fill: "pizarra" },
      { type: "circle", cx: -10, cy: -160, r: 44, fill: "gris-claro", group: "dial" },
      { type: "rect", x: -12, y: -202, w: 4, h: 14, fill: "tinta", group: "dial" },
      { type: "rect", x: -12, y: -132, w: 4, h: 14, fill: "tinta", group: "dial" },
      { type: "rect", x: 60, y: -200, w: 16, h: 80, r: 8, fill: "gris-claro" },
      { type: "rect", x: -110, y: -10, w: 30, h: 10, fill: "tinta" },
      { type: "rect", x: 80, y: -10, w: 30, h: 10, fill: "tinta" },
    ],
    groups: [{ id: "dial", motion: "girar", speed: 0.1, amount: 0, pivotX: -10, pivotY: -160 }],
  },
  planta: {
    kind: "planta",
    what: "planta en maceta que se mece",
    where: "piso",
    w: 150,
    h: 280,
    shapes: [
      { type: "ellipse", cx: -30, cy: -170, rx: 24, ry: 86, fill: "verde", group: "hojas" },
      { type: "ellipse", cx: 30, cy: -170, rx: 24, ry: 86, fill: "verde", group: "hojas" },
      { type: "ellipse", cx: 0, cy: -190, rx: 22, ry: 90, fill: "verde-oscuro", group: "hojas" },
      { type: "path", d: "M -55 -100 L 55 -100 L 42 0 L -42 0 Z", fill: "bordo" },
      { type: "rect", x: -58, y: -108, w: 116, h: 16, r: 6, fill: "rosa" },
    ],
    groups: [{ id: "hojas", motion: "mecer", speed: 0.18, amount: 2, pivotX: 0, pivotY: -100 }],
  },
};
