import "@fontsource-variable/inter-tight";
import { useEffect, useState } from "react";
import {
  AbsoluteFill,
  Audio,
  continueRender,
  delayRender,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { type GuionScene, guion } from "./guion";
import { DataBox, Headline, Karaoke } from "./overlays";
import { actorState, Person } from "./person";
import { PropView } from "./props";
import { SetView } from "./sets";
import { cueTime, ramp, type Word } from "./timing";

// El video animado: cada escena del guion con su voz (de V0-3). Todo lo que se ve sale del guion.

export type SceneVoice = { audio: string; words: Word[]; frames: number };
export type AnimVideoProps = { voices: SceneVoice[]; only?: number };

/** Frena el render hasta que la tipografía cargó (si no, el primer cuadro sale con otra letra). */
function useFonts() {
  const [handle] = useState(() => delayRender("fuentes"));
  useEffect(() => {
    Promise.all([
      document.fonts.load('900 80px "Inter Tight Variable"', "¿Cómo ÁÉÍÓÚÑ 0123456789$%"),
      document.fonts.load('800 60px "Inter Tight Variable"', "¿Cómo ÁÉÍÓÚÑ 0123456789$%"),
    ]).then(() => continueRender(handle));
  }, [handle]);
}

/** La cámara del guion en el segundo `t`: suave entre puntos y con un leve acercamiento siempre. */
function cameraAt(scene: GuionScene, t: number, words: Word[], duration: number) {
  const keys = scene.camera
    .map((k) => ({ ...k, time: cueTime(k.at, words) }))
    .sort((a, b) => a.time - b.time);
  const first = keys[0] ?? { zoom: 1, x: 540, y: 960, time: 0 };
  let cam = { zoom: first.zoom, x: first.x, y: first.y };
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (!a || !b || t < a.time) break;
    const k = ramp(t, a.time, b.time);
    cam = {
      zoom: a.zoom + (b.zoom - a.zoom) * k,
      x: a.x + (b.x - a.x) * k,
      y: a.y + (b.y - a.y) * k,
    };
  }
  return { ...cam, zoom: cam.zoom * (1 + 0.03 * (t / duration)) };
}

function Scene({ scene, voice }: { scene: GuionScene; voice: SceneVoice }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const duration = voice.frames / fps;
  const words = voice.words;
  const { zoom, x: cx, y: cy } = cameraAt(scene, t, words, duration);
  // Los personajes de más abajo van adelante.
  const actors = scene.actors
    .map((actor, i) => ({ actor, i, state: actorState(actor, t, words, fps) }))
    .sort((a, b) => a.actor.y - b.actor.y);
  return (
    <AbsoluteFill style={{ background: "#000", overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          width: 1080,
          height: 1920,
          transformOrigin: "0 0",
          transform: `translate(${540 - cx * zoom}px, ${960 - cy * zoom}px) scale(${zoom})`,
        }}
      >
        <svg
          width={1080}
          height={1920}
          viewBox="0 0 1080 1920"
          role="img"
          aria-label={scene.narration}
        >
          <SetView setting={scene.setting} t={t} />
          {scene.props.map((prop) => (
            <PropView
              key={`${prop.kind}-${prop.x}-${prop.y}`}
              prop={prop}
              t={t}
              words={words}
              fps={fps}
            />
          ))}
          {actors.map(({ actor, i, state }) => (
            <Person key={actor.id} actor={actor} state={state} t={t} seed={i + 1} />
          ))}
        </svg>
      </div>
      {scene.overlays.map((box) => (
        <DataBox key={`${box.text}-${box.y}`} box={box} words={words} t={t} fps={fps} />
      ))}
      <Karaoke words={words} highlight={scene.highlight} t={t} />
      <Headline scene={scene} words={words} t={t} fps={fps} />
      {voice.audio ? <Audio src={staticFile(voice.audio)} /> : null}
    </AbsoluteFill>
  );
}

export const AnimVideo = ({ voices, only }: AnimVideoProps) => {
  useFonts();
  const scenes = guion
    .map((scene, i) => ({ scene, i, voice: voices[scene.voice] }))
    .filter((s) => (only === undefined || s.i === only) && s.voice !== undefined);
  let from = 0;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {scenes.map(({ scene, i, voice }) => {
        if (!voice) return null;
        const start = from;
        from += voice.frames;
        return (
          <Sequence key={i} from={start} durationInFrames={voice.frames}>
            <Scene scene={scene} voice={voice} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

/** Largo total en cuadros, para `calculateMetadata`. */
export function animFrames({ voices, only }: AnimVideoProps): number {
  return guion
    .filter((_, i) => only === undefined || i === only)
    .reduce((sum, scene) => sum + (voices[scene.voice]?.frames ?? 0), 0);
}
