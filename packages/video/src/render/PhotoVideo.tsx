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
import { PHOTO_SIZE, type PhotoFormat, place, showsWhole, type View } from "./framing";
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
export type { PhotoFormat, View };
export { PHOTO_SIZE };
export type Shot = {
  voice: number;
  image: string;
  /** alto / ancho de la imagen */
  aspect: number;
  from: View;
  to: View;
  credit: string;
  /** La foto entera sobre un fondo desenfocado, en vez de cubrir el cuadro (ver `showsWhole`). */
  whole?: boolean;
  highlight?: string[];
  graphics?: Graphic[];
  /** La opinión del operador: lleva el cartel «Opinión» (ADR 0031). */
  opinion?: boolean;
  /** Cola después de la voz, en segundos. */
  tail?: number;
};
export type PhotoVideoProps = { voices: SceneVoice[]; shots: Shot[]; format?: PhotoFormat };

// Karaoke y crédito según el formato: en 16:9 los subtítulos van arriba y más chicos.
const LAYOUT = {
  "9x16": {
    karaoke: { top: 286, maxWidth: 940, fontSize: 60 },
    creditBottom: 150,
    creditSize: 30,
    creditSide: 48,
    // under the apps' top bar, above the subtitles
    opinion: { top: 196, left: 70, fontSize: 34 },
  },
  "16x9": {
    karaoke: { top: 56, maxWidth: 1500, fontSize: 52 },
    creditBottom: 36,
    creditSize: 24,
    creditSide: 60,
    // bottom left, above the credit: wide subtitles take the top
    opinion: { bottom: 84, left: 60, fontSize: 28 },
  },
} as const;

type SceneShot = Pick<
  Shot,
  "image" | "aspect" | "from" | "to" | "credit" | "whole" | "highlight" | "graphics" | "opinion"
>;

/**
 * Lo que se ve de una escena en un momento: la foto (cubriendo el cuadro, o entera sobre una copia
 * desenfocada), la viñeta, los gráficos, los subtítulos y el crédito. Lo usan el video y el cuadro
 * fijo de cada escena (`FrameStill`), así el cuadro es lo mismo que va a salir.
 */
export function SceneLayers({
  shot,
  format,
  k,
  words,
  t,
  graphicTime,
}: {
  shot: SceneShot;
  format: PhotoFormat;
  /** 0 = encuadre `from`, 1 = `to`. */
  k: number;
  words: SceneVoice["words"];
  /** Segundo de la escena, para los subtítulos. */
  t: number;
  /** El segundo en que se dibuja cada gráfico; null: no se dibuja. */
  graphicTime: (g: Graphic) => number | null;
}) {
  const lay = LAYOUT[format];
  const whole = showsWhole(shot.from, shot.to, shot.aspect, format, shot.whole);
  const a = place(shot.from, shot.aspect, format, whole);
  const b = place(shot.to, shot.aspect, format, whole);
  const mix = (p: number, q: number) => p + (q - p) * k;
  return (
    <>
      {whole && (
        <Img
          src={staticFile(shot.image)}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: "scale(1.15)",
            filter: "blur(48px) brightness(0.42) saturate(0.85)",
          }}
        />
      )}
      <Img
        src={staticFile(shot.image)}
        style={{
          position: "absolute",
          width: mix(a.dw, b.dw),
          height: mix(a.dh, b.dh),
          left: mix(a.left, b.left),
          top: mix(a.top, b.top),
          filter: "sepia(0.18) contrast(1.05) brightness(0.92)",
          boxShadow: whole ? "0 20px 60px rgba(0,0,0,0.6)" : undefined,
        }}
      />
      {/* viñeta y degradados para que se lean los subtítulos y el crédito */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%), linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 28%, rgba(0,0,0,0) 80%, rgba(0,0,0,0.6) 100%)",
        }}
      />
      {(shot.graphics ?? []).map((g, i) => {
        const at = graphicTime(g);
        return at === null ? null : (
          // biome-ignore lint/suspicious/noArrayIndexKey: el orden de los gráficos es fijo
          <GraphicView key={i} g={g} t={at} words={words} format={format} />
        );
      })}
      {shot.opinion && (
        <div
          style={{
            position: "absolute",
            ...lay.opinion,
            padding: "8px 22px",
            borderRadius: 999,
            background: "#E3B04B",
            color: "#100D0A",
            fontFamily: "'Inter Tight Variable', sans-serif",
            fontWeight: 800,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            boxShadow: "0 6px 20px rgba(0,0,0,0.5)",
          }}
        >
          Opinión
        </div>
      )}
      <Karaoke words={words} highlight={shot.highlight ?? []} t={t} {...lay.karaoke} />
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
    </>
  );
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
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const k = interpolate(frame, [0, framesOf(shot, voice)], [0, 1], {
    extrapolateRight: "clamp",
    easing: (x) => x * x * (3 - 2 * x),
  });
  const fade = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: "#0C0B0A", overflow: "hidden", opacity: fade }}>
      <SceneLayers
        shot={shot}
        format={format}
        k={k}
        words={voice.words}
        t={frame / fps}
        graphicTime={() => frame / fps}
      />
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
