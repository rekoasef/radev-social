import { Easing, interpolate } from "remotion";
import type { Cue } from "../script";

export type Word = { word: string; start: number; end: number };

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9%]/g, "");

/** Segundo de la escena en que pasa un `Cue`. Falla si la palabra no está en la voz. */
export function cueTime(cue: Cue, words: Word[]): number {
  if (typeof cue === "number") return cue;
  const target = norm(cue.word);
  const word = words.filter((w) => norm(w.word) === target)[(cue.nth ?? 1) - 1];
  if (!word) throw new Error(`La palabra "${cue.word}" no está en la voz de la escena.`);
  return (cue.edge === "end" ? word.end : word.start) + (cue.offset ?? 0);
}

/** 0→1 suave entre `from` y `to` (segundos). */
export function ramp(t: number, from: number, to: number): number {
  return interpolate(t, [from, to], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
}
