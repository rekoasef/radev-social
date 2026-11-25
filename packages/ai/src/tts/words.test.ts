import { describe, expect, it } from "vitest";
import { countWords, wordsFromChars } from "./words";

const align = (text: string, step = 0.1) => ({
  characters: [...text],
  character_start_times_seconds: [...text].map((_, i) => i * step),
  character_end_times_seconds: [...text].map((_, i) => (i + 1) * step),
});

describe("wordsFromChars", () => {
  it("groups characters into words with the start of the first and the end of the last", () => {
    expect(wordsFromChars(align("Hola mundo."))).toEqual([
      { word: "Hola", start: 0, end: 0.4 },
      { word: "mundo.", start: 0.5, end: 1.1 },
    ]);
  });

  it("keeps punctuation and numbers inside the word, and ignores repeated spaces", () => {
    const words = wordsFromChars(align("En  1911,  ¿quién?"));
    expect(words.map((w) => w.word)).toEqual(["En", "1911,", "¿quién?"]);
  });

  it("counts the same words as the scene text", () => {
    const text = "21 de agosto de 1911. El Louvre amanece cerrado.";
    expect(wordsFromChars(align(text))).toHaveLength(countWords(text));
  });

  it("returns nothing for an empty alignment", () => {
    expect(wordsFromChars(align(""))).toEqual([]);
  });
});
