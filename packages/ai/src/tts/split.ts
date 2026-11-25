import type { TtsWord } from "./types";
import { countWords } from "./words";

// Cuts the whole take by scene. The cut falls in the middle of the silence between the last word of
// a scene and the first of the next: the natural pause is split between the two and the
// intonation is never restarted (V0-12). Each scene is padded to a whole number of video frames, so
// the audio of every scene lasts exactly what its frames last (REVISION §4.5).

export const VIDEO_FPS = 30;
export const SAMPLE_RATE = 48_000;

export type SceneAudio = {
  index: number;
  /** Mono 16-bit PCM at SAMPLE_RATE, padded with silence to `frames` whole frames. */
  pcm: Int16Array;
  frames: number;
  /** The scene's words with times relative to the start of the scene. */
  words: TtsWord[];
};

const round3 = (x: number) => Math.round(x * 1000) / 1000;

/**
 * `pcm`: the whole take decoded to mono 16-bit at SAMPLE_RATE. `words`: exactly the words of
 * `texts`, in order, with absolute times. Throws if the counts do not match.
 */
export function splitScenes(
  pcm: Int16Array,
  words: readonly TtsWord[],
  texts: readonly string[],
  options: { rate?: number; fps?: number } = {},
): SceneAudio[] {
  const rate = options.rate ?? SAMPLE_RATE;
  const fps = options.fps ?? VIDEO_FPS;
  const perFrame = Math.floor(rate / fps);
  const counts = texts.map(countWords);
  const total = counts.reduce((a, b) => a + b, 0);
  if (total !== words.length) {
    throw new Error(`Palabras del texto ${total} ≠ palabras de la voz ${words.length}`);
  }

  const cuts = [0];
  let at = 0;
  for (const n of counts.slice(0, -1)) {
    at += n;
    const last = words[at - 1];
    const first = words[at];
    if (!last || !first) throw new Error("Una escena sin palabras no se puede cortar.");
    cuts.push(Math.round(((last.end + first.start) / 2) * rate));
  }
  cuts.push(pcm.length);

  const scenes: SceneAudio[] = [];
  at = 0;
  for (const [i, n] of counts.entries()) {
    const a = cuts[i] ?? 0;
    const b = cuts[i + 1] ?? pcm.length;
    const frames = Math.ceil((b - a) / perFrame);
    const chunk = new Int16Array(frames * perFrame); // zeros: the silence of the padding
    chunk.set(pcm.subarray(a, b));
    const offset = a / rate;
    scenes.push({
      index: i,
      pcm: chunk,
      frames,
      words: words.slice(at, at + n).map((w) => ({
        word: w.word,
        start: round3(w.start - offset),
        end: round3(w.end - offset),
      })),
    });
    at += n;
  }
  return scenes;
}
