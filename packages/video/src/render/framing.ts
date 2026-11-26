// Dónde va la foto en el cuadro, sin React (con tests). Las vistas se piensan en vertical.

export type View = { cx: number; cy: number; vw: number };
export type PhotoFormat = "9x16" | "16x9";

export const PHOTO_SIZE = {
  "9x16": { width: 1080, height: 1920 },
  "16x9": { width: 1920, height: 1080 },
} as const;

/** Por debajo de esta parte de lo pedido, la foto va entera aunque nadie lo pida (una panorámica). */
const FORCE = 0.5;
/** Pedida entera, se cumple si cubrir mostraría menos que esto. */
const ASKED = 0.75;

/** Fracción de ALTO de la imagen que muestra una vista vertical (cubriendo el cuadro). */
function verticalHeight(v: View, aspect: number): number {
  const V = PHOTO_SIZE["9x16"];
  const dw = Math.max(V.width / v.vw, V.height / aspect);
  return Math.min(1, V.height / (dw * aspect));
}

/**
 * Si la foto va entera (sobre una copia desenfocada) en vez de cubrir el cuadro. Por defecto cubre.
 * Va entera si el guion lo pide (`asked`: una foto apaisada de un grupo o un documento, en el
 * Short) o si cubrir mostraría menos de la mitad de lo pedido (una panorámica). Una decisión por
 * escena: nunca cambia en medio del zoom.
 */
export function showsWhole(
  from: View,
  to: View,
  aspect: number,
  format: PhotoFormat,
  asked = false,
): boolean {
  const { width: W, height: H } = PHOTO_SIZE[format];
  if (format === "9x16") {
    // cubriendo, lo más ancho que se puede ver de la imagen
    const widest = Math.min(1, (W * aspect) / H);
    if (widest >= 0.999) return false;
    return asked || widest < FORCE * Math.min(from.vw, to.vw);
  }
  const tallest = Math.min(1, H / (W * aspect));
  if (tallest >= 0.999) return false;
  const wanted = Math.min(verticalHeight(from, aspect), verticalHeight(to, aspect));
  return (asked && tallest < ASKED) || tallest < FORCE * wanted;
}

/**
 * En 16:9 se conserva cuánto se ve de ALTO de la imagen (para que el sujeto no quede cortado) y se
 * abre el ancho; si la imagen no alcanza, se muestra entera de ancho.
 */
export function adaptView(v: View, aspect: number, format: PhotoFormat): View {
  if (format === "9x16") return v;
  const Wd = PHOTO_SIZE["16x9"];
  const dwWide = Math.max(Wd.width, Wd.height / (verticalHeight(v, aspect) * aspect));
  return { cx: v.cx, cy: v.cy, vw: Math.min(1, Wd.width / dwWide) };
}

export type Placement = { dw: number; dh: number; left: number; top: number };

const along = (size: number, frame: number, center: number) =>
  size <= frame
    ? (frame - size) / 2
    : frame / 2 - Math.min(1 - frame / 2 / size, Math.max(frame / 2 / size, center)) * size;

/** Dónde queda la imagen para una vista: cubriendo el cuadro, o entera (`whole`). */
export function place(v: View, aspect: number, format: PhotoFormat, whole = false): Placement {
  const { width: W, height: H } = PHOTO_SIZE[format];
  let dw: number;
  if (!whole) {
    const a = adaptView(v, aspect, format);
    dw = Math.max(W / a.vw, H / aspect); // que la imagen siempre cubra el cuadro
  } else if (format === "9x16") {
    // de todo el ancho al detalle pedido, sin pasar el alto del cuadro
    dw = Math.min(W / v.vw, H / aspect);
  } else {
    // el alto que pedía la vista vertical, entero
    dw = H / (verticalHeight(v, aspect) * aspect);
  }
  const dh = dw * aspect;
  return { dw, dh, left: along(dw, W, v.cx), top: along(dh, H, v.cy) };
}
