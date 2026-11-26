// Un cuadro fijo por escena, como va a salir en el video (foto recortada, carteles, pie y crédito),
// sin voz. Lo miran la Verificación y el operador en su escritorio (docs/VIDEO-CALIDAD.md). Los
// archivos se nombran por su contenido: un cuadro se dibuja de nuevo solo si la escena cambió.
import type { ImageCandidate } from "./images";
import { shortCredit } from "./images";
import type { Graphic, Script, ScriptScene, View } from "./script";

/** Sube si cambia cómo se dibuja un cuadro: los viejos dejan de servir. */
export const FRAME_VERSION = 1;
export const FRAME_FORMATS = ["9x16", "16x9"] as const;
export type FrameFormat = (typeof FRAME_FORMATS)[number];

export type FrameProps = {
  format: FrameFormat;
  image: string;
  /** alto / ancho de la imagen */
  aspect: number;
  from: View;
  to: View;
  credit: string;
  whole: boolean;
  graphics: Graphic[];
  highlight: string[];
  narration: string;
};

export function frameProps(
  scene: ScriptScene,
  candidate: ImageCandidate,
  format: FrameFormat,
): FrameProps {
  return {
    format,
    image: candidate.file,
    aspect: candidate.height / candidate.width,
    from: scene.from,
    to: scene.to,
    credit: shortCredit(candidate, scene.caption),
    whole: scene.whole ?? false,
    graphics: scene.graphics,
    highlight: scene.highlight ?? [],
    narration: scene.narration,
  };
}

/** FNV-1a de 32 bits, en hexadecimal: igual en la web y en el worker, sin depender de node. */
function hash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** El nombre del cuadro de una escena: cambia con cualquier cosa que se vea en él. */
export function frameKey(scene: ScriptScene, candidate: ImageCandidate): string {
  const { format: _, ...props } = frameProps(scene, candidate, "9x16");
  return `${hash(JSON.stringify([FRAME_VERSION, candidate.width, candidate.height, props]))}`;
}

/** Relativo a la carpeta del video. */
export const framePath = (key: string, format: FrameFormat) => `frames/${key}-${format}.jpg`;

export type SceneFrame = { scene: number; key: string; candidate: ImageCandidate };

/** Los cuadros del guion; las escenas con una imagen que no existe quedan afuera. */
export function sceneFrames(script: Script, candidates: ImageCandidate[]): SceneFrame[] {
  return script.scenes.flatMap((scene, i) => {
    const candidate = candidates.find((c) => c.id === scene.image);
    return candidate ? [{ scene: i + 1, key: frameKey(scene, candidate), candidate }] : [];
  });
}
