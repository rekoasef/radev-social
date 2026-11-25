// Utilidades de texto compartidas por las oficinas. Sin I/O.

/** Cómo compara las palabras el render (subtítulos y cues): sin mayúsculas, tildes ni signos. */
export const normWord = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9%]/g, "");

/** Las palabras de la narración como las va a separar la voz (por espacios). */
export const narrationWords = (narration: string) =>
  narration.split(/\s+/).map(normWord).filter(Boolean);

/** Los números de un texto ("1.911" → "1911", "18,5" queda como está salvo miles). */
export const numbersIn = (text: string) =>
  [...text.matchAll(/\d[\d.,]*/g)].map((m) =>
    m[0].replace(/[.,]+$/g, "").replace(/[.,](?=\d{3}\b)/g, ""),
  );

/** Recorta en un espacio y agrega «…». */
export const cut = (t: string, n: number) =>
  t.length <= n ? t : `${t.slice(0, t.lastIndexOf(" ", n) > 20 ? t.lastIndexOf(" ", n) : n)}…`;

/** Segundos → "m:ss" (los capítulos de YouTube). */
export const clock = (sec: number) =>
  `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
