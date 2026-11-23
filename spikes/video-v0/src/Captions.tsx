import "@fontsource-variable/inter-tight";
import "@fontsource-variable/space-grotesk";
import {
  AbsoluteFill,
  Audio,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

// V0-2: voz + subtítulos palabra por palabra, para juzgar a ojo si los tiempos están sincronizados.
export type Word = { word: string; start: number; end: number };
export type CaptionsProps = { audio: string; words: Word[]; seconds: number };
// V0-3: una escena. Sin `audio` el clip sale mudo (la voz se arma aparte con FFmpeg).
export type SceneProps = {
  audio: string;
  words: Word[];
  frames: number;
  bg: string;
  label: string;
};

const C = { bg: "#0E0F12", text: "#F4F1EA", accent: "#FF6A1A", dim: "rgba(244,241,234,0.35)" };
const MAX_WORDS = 4;

// Agrupa en frases cortas: corta después de puntuación o cada MAX_WORDS palabras.
const toLines = (words: Word[]) => {
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
};

export const Scene = ({ audio, words, bg, label }: SceneProps) => (
  <Captions audio={audio} words={words} seconds={0} bg={bg} label={label} />
);

export const Captions = ({
  audio,
  words,
  bg = C.bg,
  label = "",
}: CaptionsProps & { bg?: string; label?: string }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const lines = toLines(words);
  // La frase visible: la última que ya empezó (queda en pantalla hasta que arranca la siguiente).
  const line = [...lines].reverse().find((l) => (l[0]?.start ?? 0) <= t) ?? lines[0] ?? [];

  return (
    <AbsoluteFill style={{ backgroundColor: bg, fontFamily: "'Inter Tight Variable', sans-serif" }}>
      {audio ? <Audio src={staticFile(audio)} /> : null}
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: "0 90px" }}>
        <div
          style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "10px 22px" }}
        >
          {line.map((w) => {
            const active = t >= w.start && t < w.end;
            const pop = active
              ? interpolate(t - w.start, [0, 0.08], [0.9, 1], { extrapolateRight: "clamp" })
              : 1;
            return (
              <span
                key={w.start}
                style={{
                  fontSize: 92,
                  fontWeight: 800,
                  lineHeight: 1.1,
                  padding: "4px 14px",
                  borderRadius: 14,
                  color: t < w.start ? C.dim : C.text,
                  backgroundColor: active ? C.accent : "transparent",
                  transform: `scale(${pop})`,
                }}
              >
                {w.word}
              </span>
            );
          })}
        </div>
      </AbsoluteFill>
      {/* Reloj para comparar con el audio al revisar cuadro por cuadro. */}
      <div
        style={{
          position: "absolute",
          bottom: 60,
          width: "100%",
          textAlign: "center",
          color: C.dim,
          fontSize: 34,
        }}
      >
        {label ? `${label} · ` : ""}
        {t.toFixed(2)} s
      </div>
    </AbsoluteFill>
  );
};
