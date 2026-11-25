import { z } from "zod";
import type { ImageCandidate } from "./images";
import { type Publication, publicationSchema } from "./publication";

// El documento `package` de la oficina de Publicación: lo que se sube a YouTube (título, gancho,
// capítulos, las dos descripciones) y dónde quedaron las miniaturas. Es lo que baja el operador.

export const packageDocSchema = z.object({
  publication: publicationSchema,
  /** La descripción del video normal (16:9): con capítulos y todos los créditos. */
  descriptionNormal: z.string(),
  /** La del Short (9:16): sin capítulos, con #Shorts. */
  descriptionShort: z.string(),
  credits: z.string(),
  /** Relativo a la carpeta del video. */
  thumbnails: z.object({ "9x16": z.string(), "16x9": z.string() }),
});
export type PackageDoc = z.infer<typeof packageDocSchema>;

export type ThumbnailProps = {
  format: "16x9" | "9x16";
  /** Archivo de la imagen, relativo a la carpeta del video (`images/i05.jpg`). */
  image: string;
  /** alto / ancho de la imagen */
  aspect: number;
  view: { cx: number; cy: number; vw: number };
  kicker: string;
  lines: string[];
  accent: string;
};

/**
 * Los datos de una miniatura. En 16:9 una foto vertical se recorta a una franja: se abre el encuadre
 * y el sujeto se corre a la derecha, lejos del texto (lección de V0).
 */
export function thumbnailProps(
  publication: Publication,
  image: ImageCandidate,
  format: "16x9" | "9x16",
): ThumbnailProps {
  const t = publication.thumbnail;
  const aspect = image.height / image.width;
  const view =
    format === "16x9" && aspect > 1.1
      ? { cx: Math.max(0, t.cx - 0.08), cy: t.cy - 0.03, vw: Math.min(1, t.vw * 1.7) }
      : { cx: t.cx, cy: t.cy, vw: t.vw };
  return {
    format,
    image: image.file,
    aspect,
    view,
    kicker: t.kicker,
    lines: t.lines,
    accent: t.accent,
  };
}
