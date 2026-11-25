import "@fontsource-variable/inter-tight";
import { AbsoluteFill, Audio, Img, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Karaoke } from "../anim/overlays";
import type { SceneVoice } from "../anim/guion";
import { GraphicView } from "./graphics";
import type { DocuGraphic } from "./schema";

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
  graphics?: DocuGraphic[];
  /** Cola después de la voz, en segundos. */
  tail?: number;
};
export type PhotoVideoProps = { voices: SceneVoice[]; shots: Shot[] };

const W = 1080;
const H = 1920;

/** Dónde queda la imagen en el cuadro para una vista (centro y fracción de ancho visible). */
function place(v: View, aspect: number) {
  const dw = Math.max(W / v.vw, H / aspect); // que la imagen siempre cubra el cuadro
  const dh = dw * aspect;
  const cx = Math.min(1 - W / 2 / dw, Math.max(W / 2 / dw, v.cx));
  const cy = Math.min(1 - H / 2 / dh, Math.max(H / 2 / dh, v.cy));
  return { dw, dh, left: W / 2 - cx * dw, top: H / 2 - cy * dh };
}

const framesOf = (shot: Shot, voice: SceneVoice) => voice.frames + Math.round((shot.tail ?? 0) * 30);

function PhotoScene({ shot, voice }: { shot: Shot; voice: SceneVoice }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const k = interpolate(frame, [0, framesOf(shot, voice)], [0, 1], {
    extrapolateRight: "clamp",
    easing: (x) => x * x * (3 - 2 * x),
  });
  const a = place(shot.from, shot.aspect);
  const b = place(shot.to, shot.aspect);
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
        <GraphicView key={i} g={g} t={frame / fps} words={voice.words} />
      ))}
      <Karaoke words={voice.words} highlight={shot.highlight ?? []} t={frame / fps} />
      <div
        style={{
          position: "absolute",
          left: 48,
          right: 48,
          bottom: 150,
          fontFamily: "'Inter Tight Variable', sans-serif",
          fontSize: 30,
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
  shots.reduce((sum, s) => sum + (voices[s.voice] ? framesOf(s, voices[s.voice] as SceneVoice) : 0), 0);

export const PhotoVideo = ({ voices, shots }: PhotoVideoProps) => {
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
            <PhotoScene shot={shot} voice={voice} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
