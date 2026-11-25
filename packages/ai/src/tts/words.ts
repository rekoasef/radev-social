import type { TtsWord } from "./types";

/** ElevenLabs' times per character, as `with-timestamps` returns them. */
export type CharAlignment = {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
};

const round3 = (x: number) => Math.round(x * 1000) / 1000;

/** The words of the text (split on whitespace) with the time of their first and last character. */
export function wordsFromChars(alignment: CharAlignment): TtsWord[] {
  const {
    characters,
    character_start_times_seconds: starts,
    character_end_times_seconds: ends,
  } = alignment;
  const words: TtsWord[] = [];
  let cur = "";
  let start: number | null = null;
  let end = 0;
  characters.forEach((ch, i) => {
    const s = starts[i] ?? 0;
    const e = ends[i] ?? s;
    if (/\s/.test(ch)) {
      if (cur && start !== null) words.push({ word: cur, start: round3(start), end: round3(end) });
      cur = "";
      start = null;
      return;
    }
    if (start === null) start = s;
    cur += ch;
    end = e;
  });
  if (cur && start !== null) words.push({ word: cur, start: round3(start), end: round3(end) });
  return words;
}

/** How many words a scene's text has, counted the way the voice splits them (whitespace). */
export const countWords = (text: string): number => text.split(/\s+/).filter(Boolean).length;
