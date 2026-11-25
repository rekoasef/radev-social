import "@fontsource-variable/inter-tight";
import {
  AbsoluteFill,
  Audio,
  Img,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { Graphic } from "../script";
import { GraphicView } from "./graphics";
import { Karaoke } from "./karaoke";

/** La voz de una escena: su WAV (relativo a la carpeta pública), sus palabras con tiempos y sus cuadros. */
export type SceneVoice = {
  audio: string;
  words: { word: string; start: number; end: number }[];
  frames: number;
};

// Prototipo de formato "imágenes reales": una foto o documento de archivo por escena, con zoom lento
// (Ken Burns), subtítulos de la voz y el crédito de la imagen. Las imágenes se acreditan siempre.
export type View = { cx: number; cy: number; vw: number };
export type Shot = {
  voice: number;
  image: string;
  /** alto / ancho de la imagen */
  aspect: number;
  from: View;
  to: View;
  credit: string;
  highlight?: string[];
  graphics?: Graphic[];
  /** Cola después de la voz, en segundos. */
  tail?: number;
};
export type PhotoFormat = "9x16" | "16x9";
export type PhotoVideoProps = { voices: SceneVoice[]; shots: Shot[]; format?: PhotoFormat };

export const PHOTO_SIZE = {
  "9x16": { width: 1080, height: 1920 },
  "16x9": { width: 1920, height: 1080 },
} as const;
// Karaoke y crédito según el formato: en 16:9 los subtítulos van arriba y más chicos.
const LAYOUT = {
  "9x16": {
    karaoke: { top: 286, maxWidth: 940, fontSize: 60 },
    creditBottom: 150,
    creditSize: 30,
    creditSide: 48,
  },
  "16x9": {
    karaoke: { top: 56, maxWidth: 1500, fontSize: 52 },
    creditBottom: 36,
    creditSize: 24,
    creditSide: 60,
  },
} as const;

/**
 * Las vistas se piensan en vertical. En 16:9 se conserva cuánto se ve de ALTO de la imagen (para que
 * el sujeto no quede cortado) y se abre el ancho; si la imagen no alcanza, se muestra entera de ancho.
 */
function adaptView(v: View, aspect: number, format: PhotoFormat): View {
  if (format === "9x16") return v;
  const V = PHOTO_SIZE["9x16"];
  const Wd = PHOTO_SIZE["16x9"];
  const dwV = Math.max(V.width / v.vw, V.height / aspect);
  const heightFraction = Math.min(1, V.height / (dwV * aspect));
  const dwWide = Math.max(Wd.width, Wd.height / (heightFraction * aspect));
  return { cx: v.cx, cy: v.cy, vw: Math.min(1, Wd.width / dwWide) };
}

/** Dónde queda la imagen en el cuadro para una vista (centro y fracción de ancho visible). */
function place(v: View, aspect: number, format: PhotoFormat) {
  const { width: W, height: H } = PHOTO_SIZE[format];
  const dw = Math.max(W / v.vw, H / aspect); // que la imagen siempre cubra el cuadro
  const dh = dw * aspect;
  const cx = Math.min(1 - W / 2 / dw, Math.max(W / 2 / dw, v.cx));
  const cy = Math.min(1 - H / 2 / dh, Math.max(H / 2 / dh, v.cy));
  return { dw, dh, left: W / 2 - cx * dw, top: H / 2 - cy * dh };
}

const framesOf = (shot: Shot, voice: SceneVoice) =>
  voice.frames + Math.round((shot.tail ?? 0) * 30);

function PhotoScene({
  shot,
  voice,
  format,
}: {
  shot: Shot;
  voice: SceneVoice;
  format: PhotoFormat;
}) {
  const lay = LAYOUT[format];
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const k = interpolate(frame, [0, framesOf(shot, voice)], [0, 1], {
    extrapolateRight: "clamp",
    easing: (x) => x * x * (3 - 2 * x),
  });
  const a = place(adaptView(shot.from, shot.aspect, format), shot.aspect, format);
  const b = place(adaptView(shot.to, shot.aspect, format), shot.aspect, format);
  const mix = (p: number, q: number) => p + (q - p) * k;
  const fade = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: "#0C0B0A", overflow: "hidden", opacity: fade }}>
      <Img
        src={staticFile(shot.image)}
        style={{
          position: "absolute",
          width: mix(a.dw, b.dw),
          height: mix(a.dh, b.dh),
          left: mix(a.left, b.left),
          top: mix(a.top, b.top),
          filter: "sepia(0.18) contrast(1.05) brightness(0.92)",
        }}
      />
      {/* viñeta y degradados para que se lean los subtítulos y el crédito */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%), linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 28%, rgba(0,0,0,0) 80%, rgba(0,0,0,0.6) 100%)",
        }}
      />
      {(shot.graphics ?? []).map((g, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: el orden de los gráficos es fijo
        <GraphicView key={i} g={g} t={frame / fps} words={voice.words} format={format} />
      ))}
      <Karaoke
        words={voice.words}
        highlight={shot.highlight ?? []}
        t={frame / fps}
        {...lay.karaoke}
      />
      <div
        style={{
          position: "absolute",
          left: lay.creditSide,
          right: lay.creditSide,
          bottom: lay.creditBottom,
          fontFamily: "'Inter Tight Variable', sans-serif",
          fontSize: lay.creditSize,
          fontWeight: 600,
          color: "rgba(255,255,255,0.78)",
          textShadow: "0 2px 8px rgba(0,0,0,0.9)",
        }}
      >
        {shot.credit}
      </div>
      {voice.audio ? <Audio src={staticFile(voice.audio)} /> : null}
    </AbsoluteFill>
  );
}

export const photoFrames = ({ voices, shots }: PhotoVideoProps) =>
  shots.reduce(
    (sum, s) => sum + (voices[s.voice] ? framesOf(s, voices[s.voice] as SceneVoice) : 0),
    0,
  );

export const PhotoVideo = ({ voices, shots, format = "9x16" }: PhotoVideoProps) => {
  let from = 0;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {shots.map((shot, i) => {
        const voice = voices[shot.voice];
        if (!voice) return null;
        const start = from;
        const frames = framesOf(shot, voice);
        from += frames;
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: el orden de los planos es fijo
          <Sequence key={i} from={start} durationInFrames={frames}>
            <PhotoScene shot={shot} voice={voice} format={format} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
