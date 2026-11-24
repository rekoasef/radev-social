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
import { type GuionScene, guion, sceneFrames } from "./guion";
import { Headline, Karaoke, OverlayView } from "./overlays";
import { actorState, Person } from "./person";
import { PropView } from "./props";
import { SetView } from "./sets";
import { cueTime, ramp, type Word } from "./timing";

// El video animado: cada escena del guion con su voz (de V0-3). Todo lo que se ve sale del guion.

export type { SceneVoice } from "./guion";

import type { SceneVoice } from "./guion";
/** `script`: otro guion (por ejemplo, uno escrito por `claude -p` en V0-8/V0-11); por defecto, el de V0-6. */
export type AnimVideoProps = { voices: SceneVoice[]; only?: number; script?: GuionScene[] };

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
  // Nunca se ve fuera del escenario (V0-10: con zoom < 1 o el centro corrido aparecían bordes
  // negros): zoom mínimo 1 y el centro, dentro de lo que deja ver ese zoom.
  const zoom = Math.max(1, cam.zoom) * (1 + 0.03 * (t / duration));
  const clamp = (v: number, half: number, size: number) =>
    Math.min(size - half, Math.max(half, v));
  return { zoom, x: clamp(cam.x, 540 / zoom, 1080), y: clamp(cam.y, 960 / zoom, 1920) };
}

function Scene({ scene, voice }: { scene: GuionScene; voice: SceneVoice }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const duration = sceneFrames(scene, voice) / fps;
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
          {scene.props.map((prop, n) => (
            <PropView key={`${prop.kind}-${n}`} prop={prop} t={t} words={words} fps={fps} />
          ))}
          {actors.map(({ actor, i, state }) => (
            <Person key={actor.id} actor={actor} state={state} t={t} seed={i + 1} />
          ))}
        </svg>
      </div>
      {scene.overlays.map((box) => (
        <OverlayView
          key={`${box.kind}-${box.x}-${box.y}`}
          box={box}
          words={words}
          t={t}
          fps={fps}
        />
      ))}
      <Karaoke words={words} highlight={scene.highlight} t={t} />
      <Headline scene={scene} words={words} t={t} fps={fps} />
      {voice.audio ? <Audio src={staticFile(voice.audio)} /> : null}
    </AbsoluteFill>
  );
}

export const AnimVideo = ({ voices, only, script = guion }: AnimVideoProps) => {
  useFonts();
  const scenes = script
    .map((scene, i) => ({ scene, i, voice: voices[scene.voice] }))
    .filter((s) => (only === undefined || s.i === only) && s.voice !== undefined);
  let from = 0;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {scenes.map(({ scene, i, voice }) => {
        if (!voice) return null;
        const start = from;
        const frames = sceneFrames(scene, voice);
        from += frames;
        return (
          <Sequence key={i} from={start} durationInFrames={frames}>
            <Scene scene={scene} voice={voice} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

/** Largo total en cuadros, para `calculateMetadata`. */
export function animFrames({ voices, only, script = guion }: AnimVideoProps): number {
  return script
    .filter((_, i) => only === undefined || i === only)
    .reduce((sum, scene) => {
      const voice = voices[scene.voice];
      return sum + (voice ? sceneFrames(scene, voice) : 0);
    }, 0);
}
