import { z } from "zod";

// El documento `voice` de la oficina de Locución: dónde quedó el audio y la cuenta de cuadros de cada
// escena (la duración exacta del video sale de acá: `frames` por escena, más la cola del guion).

export const voiceDocSchema = z.object({
  /** Huella del texto, la voz, el modelo y la velocidad: si no cambia, no se paga la voz otra vez. */
  fingerprint: z.string(),
  voiceId: z.string(),
  model: z.string(),
  speed: z.number().nullable(),
  /** Caracteres enviados (lo que cobra el proveedor). */
  characters: z.number().int(),
  fps: z.number().int(),
  totalFrames: z.number().int(),
  /** La toma entera (para escucharla sola). */
  full: z.string(),
  scenes: z
    .array(
      z.object({
        index: z.number().int(),
        frames: z.number().int(),
        text: z.string(),
        /** WAV de la escena, relativo a la carpeta del video. */
        audio: z.string(),
        /** Palabras con tiempos relativos a la escena. */
        words: z.string(),
      }),
    )
    .min(1),
});
export type VoiceDoc = z.infer<typeof voiceDocSchema>;
