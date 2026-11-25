import { z } from "zod";

// El documento `render` de la oficina de Render y su control de calidad. Remotion renderiza el video
// ENTERO (no por escena) en los dos formatos: la voz es una sola toma (ADR 0029).

export const RENDER_FORMATS = ["9x16", "16x9"] as const;
export type RenderFormat = (typeof RENDER_FORMATS)[number];

export const VIDEO_SIZES = {
  "9x16": { width: 1080, height: 1920 },
  "16x9": { width: 1920, height: 1080 },
} as const satisfies Record<RenderFormat, { width: number; height: number }>;

export const renderDocSchema = z.object({
  fps: z.number().int(),
  totalFrames: z.number().int(),
  formats: z
    .array(
      z.object({
        format: z.enum(RENDER_FORMATS),
        /** Relativo a la carpeta del video (`render/video-9x16.mp4`). */
        file: z.string(),
        seconds: z.number(),
        bytes: z.number().int(),
        width: z.number().int(),
        height: z.number().int(),
        renderMs: z.number().int(),
      }),
    )
    .min(1),
});
export type RenderDoc = z.infer<typeof renderDocSchema>;

/** Lo que mide ffprobe de un video ya renderizado. */
export type VideoProbe = { seconds: number; width: number; height: number; bytes: number };

/** Cuadros del video: la voz de cada escena más la cola del guion (a 30 fps). */
export function videoFrames(
  voiceFrames: readonly number[],
  tails: readonly (number | undefined)[],
  fps = 30,
): number {
  return voiceFrames.reduce((sum, f, i) => sum + f + Math.round((tails[i] ?? 0) * fps), 0);
}

/**
 * Errores de calidad de un video renderizado (vacío = bien): el largo es el de la voz con su cola
 * (el render sigue la voz cuadro por cuadro), las medidas son las del formato y no está vacío.
 */
export function checkRenderQuality(
  format: RenderFormat,
  probe: VideoProbe,
  expectedFrames: number,
  fps = 30,
): string[] {
  const errors: string[] = [];
  const expected = expectedFrames / fps;
  if (Math.abs(probe.seconds - expected) > 0.25) {
    errors.push(
      `dura ${probe.seconds.toFixed(2)} s y la voz con sus colas ${expected.toFixed(2)} s`,
    );
  }
  const size = VIDEO_SIZES[format];
  if (probe.width !== size.width || probe.height !== size.height) {
    errors.push(
      `mide ${probe.width}×${probe.height} y el formato ${format} pide ${size.width}×${size.height}`,
    );
  }
  // ~100 KB por segundo es muy poco incluso para fotos quietas: un video casi vacío o cortado
  if (probe.bytes < expected * 100_000)
    errors.push(`pesa ${probe.bytes} bytes: parece vacío o cortado`);
  return errors;
}
