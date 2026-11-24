import { Easing, interpolate, spring } from "remotion";
import type { Cue } from "./guion";

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

/** Entrada con rebote: 0 antes de `at`, sube a 1 pasándose un poco. */
export function pop(t: number, at: number, fps: number): number {
  if (t < at) return 0;
  return spring({ frame: (t - at) * fps, fps, config: { damping: 9, stiffness: 180, mass: 0.6 } });
}

/** 0→1 suave entre `from` y `to` (segundos). */
export function ramp(t: number, from: number, to: number): number {
  return interpolate(t, [from, to], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
}

/** Oscilación suave (para balanceos y luces): -1..1. */
export const wave = (t: number, hz: number, phase = 0) => Math.sin((t * hz + phase) * Math.PI * 2);

/** Parpadeo: 1 = ojos abiertos; cierra ~0,12 s cada tanto, distinto por personaje. */
export function blink(t: number, seed: number): number {
  const period = 2.6 + (seed % 5) * 0.37;
  const p = (t + seed * 0.71) % period;
  return p < 0.12 ? Math.abs(p - 0.06) / 0.06 : 1;
}
