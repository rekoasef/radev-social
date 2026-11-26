import "@fontsource-variable/inter-tight";
import { AbsoluteFill } from "remotion";
import type { FrameProps } from "../frames";
import type { Graphic } from "../script";
import { SceneLayers } from "./PhotoVideo";
import { cueTime, type Word } from "./timing";

// El cuadro fijo de una escena (docs/VIDEO-CALIDAD.md): a mitad del zoom, con los gráficos ya
// entrados y la primera línea de subtítulos. Todavía no hay voz: los tiempos de las palabras son
// parejos, alcanza para ubicar los gráficos.

const SECONDS_PER_WORD = 0.32;

export const fakeWords = (narration: string): Word[] =>
  narration
    .split(/\s+/)
    .filter(Boolean)
    .map((word, i) => ({
      word,
      start: i * SECONDS_PER_WORD,
      end: i * SECONDS_PER_WORD + SECONDS_PER_WORD - 0.02,
    }));

/** Cuándo se ve entero un gráfico; null si no se puede ubicar (no se dibuja). */
export function settledTime(g: Graphic, words: Word[]): number | null {
  try {
    const starts =
      g.kind === "cronologia" ? g.items.map((it) => cueTime(it.at, words)) : [cueTime(g.at, words)];
    const ready = Math.max(...starts) + (g.kind === "cifra" ? 1.4 : 0.5);
    const end = g.until === undefined ? Number.POSITIVE_INFINITY : cueTime(g.until, words);
    return ready < end ? ready : (Math.min(...starts) + end) / 2;
  } catch {
    return null;
  }
}

export const FrameStill = (props: FrameProps) => {
  const words = fakeWords(props.narration);
  return (
    <AbsoluteFill style={{ background: "#0C0B0A", overflow: "hidden" }}>
      <SceneLayers
        shot={props}
        format={props.format}
        k={0.5}
        words={words}
        t={SECONDS_PER_WORD * 2}
        graphicTime={(g) => settledTime(g, words)}
      />
    </AbsoluteFill>
  );
};
