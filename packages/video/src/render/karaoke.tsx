import "@fontsource-variable/inter-tight";
import type { Word } from "./timing";

// Subtítulos karaoke: lo dicho en blanco, lo que falta en gris, 1–2 palabras clave en caja.
const FONT = "'Inter Tight Variable', sans-serif";
const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9%]/g, "");

const MAX_WORDS = 5;
function toLines(words: Word[]) {
  const lines: Word[][] = [];
  let cur: Word[] = [];
  for (const w of words) {
    cur.push(w);
    if (cur.length >= MAX_WORDS || /[.,:;?!]$/.test(w.word)) {
      lines.push(cur);
      cur = [];
    }
  }
  if (cur.length) lines.push(cur);
  return lines;
}

export function Karaoke({
  words,
  highlight,
  t,
  top = 286,
  maxWidth = 940,
  fontSize = 60,
}: {
  words: Word[];
  highlight: string[];
  t: number;
  top?: number;
  maxWidth?: number;
  fontSize?: number;
}) {
  const keys = new Set(highlight.map(norm));
  const lines = toLines(words);
  const line = [...lines].reverse().find((l) => (l[0]?.start ?? 0) <= t) ?? lines[0] ?? [];
  return (
    <div
      style={{
        position: "absolute",
        top,
        left: "50%",
        transform: "translateX(-50%)",
        width: "max-content",
        maxWidth,
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: "6px 14px",
        // V0-10: franja oscura detrás, del ancho del texto. Sin ella, el segundo renglón se perdía
        // contra el escenario (estantes, el plano).
        background: "rgba(12, 10, 30, 0.62)",
        borderRadius: 26,
        padding: "14px 22px",
        fontFamily: FONT,
        fontSize,
        fontWeight: 800,
        lineHeight: 1.15,
        textShadow: "0 4px 14px rgba(0,0,0,0.6)",
      }}
    >
      {line.map((w) => {
        const said = t >= w.start;
        const key = said && keys.has(norm(w.word));
        return (
          <span
            key={w.start}
            style={{
              color: said ? "#FFFFFF" : "rgba(255,255,255,0.42)",
              background: key ? "#2E5BDA" : "transparent",
              border: key ? "3px solid #6F95FF" : "3px solid transparent",
              borderRadius: 10,
              padding: "0 10px",
            }}
          >
            {w.word.replace(/\.{3}/g, "…")}
          </span>
        );
      })}
    </div>
  );
}
