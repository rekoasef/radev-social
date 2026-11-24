import type { GuionScene, Overlay } from "./guion";
import { cueTime, pop, ramp, type Word } from "./timing";

// Lo que va encima del video, fuera de la cámara: subtítulos karaoke (arriba), titular (abajo) y
// cajas de datos. Como en la referencia: lo dicho en blanco, lo que falta en gris, 1–2 palabras
// clave en caja; el titular en mayúsculas con una palabra en rojo, palabra por palabra.

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
}: {
  words: Word[];
  highlight: string[];
  t: number;
}) {
  const keys = new Set(highlight.map(norm));
  const lines = toLines(words);
  const line = [...lines].reverse().find((l) => (l[0]?.start ?? 0) <= t) ?? lines[0] ?? [];
  return (
    <div
      style={{
        position: "absolute",
        top: 300,
        left: 70,
        right: 70,
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: "6px 14px",
        fontFamily: FONT,
        fontSize: 60,
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
            {w.word}
          </span>
        );
      })}
    </div>
  );
}

export function Headline({
  scene,
  words,
  t,
  fps,
}: {
  scene: GuionScene;
  words: Word[];
  t: number;
  fps: number;
}) {
  if (!scene.headline) return null;
  const at = cueTime(scene.headline.at, words);
  if (t < at) return null;
  const parts = scene.headline.text.split(" ");
  const band = ramp(t, at, at + 0.2);
  return (
    <div
      style={{
        position: "absolute",
        top: 1390,
        left: 0,
        right: 0,
        padding: "26px 60px",
        display: "flex",
        justifyContent: "center",
        gap: 22,
        background: `linear-gradient(90deg, transparent, rgba(0,0,0,${0.55 * band}) 20%, rgba(0,0,0,${0.55 * band}) 80%, transparent)`,
        fontFamily: FONT,
        fontSize: 74,
        fontWeight: 900,
        letterSpacing: "-0.01em",
      }}
    >
      {parts.map((part, i) => {
        const s = pop(t, at + i * 0.14, fps);
        const red = part.startsWith("*");
        const text = part.replaceAll("*", "");
        return (
          <span
            key={`${i}-${text}`}
            style={{
              color: red ? "#FF3B30" : "#FFFFFF",
              transform: `scale(${s})`,
              opacity: Math.min(1, s * 2),
              display: "inline-block",
            }}
          >
            {text}
          </span>
        );
      })}
    </div>
  );
}

export function DataBox({
  box,
  words,
  t,
  fps,
}: {
  box: Overlay;
  words: Word[];
  t: number;
  fps: number;
}) {
  const at = cueTime(box.at, words);
  const enter = pop(t, at, fps);
  const leave =
    box.until === undefined
      ? 0
      : ramp(t, cueTime(box.until, words), cueTime(box.until, words) + 0.2);
  const s = enter * (1 - leave);
  if (s <= 0.001) return null;
  let text = box.text;
  if (box.count) {
    const n = Math.round(box.count.to * ramp(t, at, cueTime(box.count.until, words)));
    text = text.replace(/\d+/, String(n));
  }
  return (
    <div
      style={{
        position: "absolute",
        left: box.x,
        top: box.y,
        transform: `translate(-50%, -50%) scale(${s}) rotate(${-2 + 2 * (1 - enter)}deg)`,
        background: "#14172A",
        border: "6px solid #F2C14E",
        borderRadius: 22,
        padding: "18px 40px 20px",
        boxShadow: "0 18px 40px rgba(0,0,0,0.5)",
        textAlign: "center",
        fontFamily: FONT,
        whiteSpace: "nowrap",
      }}
    >
      <div
        style={{
          color: "#F2C14E",
          fontSize: 108,
          fontWeight: 900,
          lineHeight: 1,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {text}
      </div>
      {box.sub ? (
        <div
          style={{
            color: "#FFFFFF",
            fontSize: 34,
            fontWeight: 800,
            letterSpacing: "0.08em",
            marginTop: 8,
          }}
        >
          {box.sub}
        </div>
      ) : null}
    </div>
  );
}
