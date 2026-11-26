// Medidas de la miniatura, sin React (con tests).

/**
 * Dónde va la imagen. En vertical, una foto apaisada recortada a 9:16 queda en un pedazo borroso o
 * en puro cielo: ocupa solo la parte de arriba y el texto va debajo.
 */
export function thumbImageBox({
  format,
  aspect,
  width,
  height,
}: {
  format: "16x9" | "9x16";
  /** alto / ancho de la imagen */
  aspect: number;
  width: number;
  height: number;
}): { width: number; height: number } {
  const landscape = aspect < 1.1;
  return { width, height: format === "9x16" && landscape ? Math.round(height * 0.66) : height };
}

/** El texto más grande que entra: manda la línea más larga. */
export function thumbTextSize({
  format,
  lines,
  width,
}: {
  format: "16x9" | "9x16";
  lines: readonly string[];
  width: number;
}): number {
  const longest = Math.max(1, ...lines.map((l) => l.length));
  // Mayúsculas en peso 900: cada carácter ocupa ~0,61 del tamaño (medido en las miniaturas).
  const fits = width / (longest * 0.61);
  // El alto: en horizontal, tres líneas tienen que dejar lugar a la etiqueta de arriba.
  const max = format === "16x9" ? (lines.length > 2 ? 140 : 190) : 230;
  return Math.floor(Math.min(max, fits));
}
