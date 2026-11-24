import "@radev/slides/fonts";
import {
  exampleDatasets,
  FORMAT,
  type LookId,
  parseTheme,
  RenderSlide,
  type Slide,
  type StudioTokens,
} from "@radev/slides";
import { useLayoutEffect, useRef } from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { useFit } from "./use-fit";
import { VERTICAL, VerticalSlide } from "./vertical-slide";

// V0-5: los looks de `studio` dentro de Remotion, importando @radev/slides tal como está.
//   look-still  1080×1350, un cuadro por slide: para comparar píxel a píxel con `preview`.
//   look-scene  1080×1920, una slide en una escena 9:16 (variante A o B, con o sin movimiento).
//   looks-clip  varias escenas seguidas con la voz y los subtítulos de V0-3.

export type Word = { word: string; start: number; end: number };
type Common = { look: LookId; tokens: unknown; seed: string; brandName: string };

function studioTheme(tokens: unknown) {
  const parsed = parseTheme("studio", tokens);
  if (!parsed.ok) throw new Error(parsed.issues.join("\n"));
  if (parsed.theme.preset !== "studio") throw new Error("Se esperaba el preset studio.");
  return parsed.theme;
}

// ---------- look-still ----------

export type SlideStillProps = Common & { slides: Slide[] };

export const SlideStill = ({ look, tokens, seed, brandName, slides }: SlideStillProps) => {
  const frame = useCurrentFrame();
  const theme = studioTheme(tokens);
  const slide = slides[frame] ?? slides[0];
  const ref = useFit<HTMLDivElement>(`${look}-${frame}`);
  if (!slide) return null;
  return (
    <AbsoluteFill ref={ref}>
      <RenderSlide
        theme={theme}
        slide={slide}
        page={{ index: frame, total: slides.length }}
        seed={seed}
        brandName={brandName}
        datasets={exampleDatasets}
        look={look}
      />
    </AbsoluteFill>
  );
};

// ---------- look-scene ----------

export type Variant = "a" | "b";
export type Motion = "none" | "enter" | "stagger";
export type LookSceneProps = Common & {
  slide: Slide;
  page: { index: number; total: number };
  variant: Variant;
  motion: Motion;
  audio?: string;
  words?: Word[];
};

/** A: la slide 4:5 entera, con bandas del color de su fondo arriba y abajo. */
const A_TOP = 200;
/** B: la caja de contenido del carrusel (850×1020), más arriba, y abajo lugar para subtítulos. */
const B_BOX = { x: 80, y: 250, width: 850, height: 1020 };
/** Centro vertical de los subtítulos en cada variante. */
const CAPTIONS_Y: Record<Variant, number> = { a: 1470, b: 1390 };

/**
 * Movimiento sin tocar `slides`: se anima desde afuera, con estilos puestos en cada cuadro.
 * `translate` y `opacity` son propiedades aparte de `transform`, que usan las capas movidas a mano.
 * El fondo, el encabezado y el pie del look quedan quietos: se mueve solo el contenido.
 * - enter: la caja de contenido entera sube y aparece.
 * - stagger: cada capa (título, cuerpo) y los ítems del cuerpo entran de a uno.
 */
function applyMotion(root: HTMLElement, frame: number, fps: number, motion: Motion) {
  const ease = Easing.out(Easing.cubic);
  const enter = (el: HTMLElement, delay: number, distance: number) => {
    const p = interpolate(frame - delay, [0, 0.4 * fps], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: ease,
    });
    el.style.opacity = String(p);
    el.style.translate = `0 ${(1 - p) * distance}px`;
  };
  const content = root.querySelector<HTMLElement>("[data-fit]");
  if (!content || motion === "none") return;
  if (motion === "enter") {
    enter(content, 0, 60);
    return;
  }
  const step = Math.round(0.12 * fps);
  let delay = 0;
  for (const layer of content.querySelectorAll<HTMLElement>("[data-layer]")) {
    enter(layer, delay, 40);
    delay += step;
    // Los ítems: el primer contenedor con 2 o más hijos dentro de la capa del cuerpo.
    if (layer.dataset.layer !== "body") continue;
    let list: HTMLElement | null = layer;
    while (list && list.children.length < 2) list = list.firstElementChild as HTMLElement | null;
    for (const item of list ? Array.from(list.children) : []) {
      enter(item as HTMLElement, delay, 30);
      delay += step;
    }
  }
}

export const LookScene = (props: LookSceneProps) => {
  const { look, tokens, seed, brandName, slide, page, variant, motion, audio, words } = props;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = studioTheme(tokens);
  // En A, las bandas toman el fondo que pintó el look (se lee después de dibujar).
  const ref = useFit<HTMLDivElement>(`${look}-${variant}-${JSON.stringify(slide)}`, (root) => {
    const frameEl = root.querySelector<HTMLElement>("[data-slide-frame]");
    if (variant === "a" && frameEl) root.style.background = getComputedStyle(frameEl).background;
  });
  useLayoutEffect(() => {
    if (ref.current) applyMotion(ref.current, frame, fps, motion);
  });
  const common = {
    slide,
    page,
    seed,
    brandName,
    datasets: exampleDatasets,
    look,
  };
  return (
    <AbsoluteFill ref={ref} style={{ overflow: "hidden" }}>
      {variant === "a" ? (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: A_TOP,
            width: FORMAT.width,
            height: FORMAT.height,
          }}
        >
          <RenderSlide theme={theme} {...common} />
        </div>
      ) : (
        <VerticalSlide tokens={theme.tokens} {...common} box={B_BOX} />
      )}
      {audio ? <Audio src={staticFile(audio)} /> : null}
      {words?.length ? (
        <Captions words={words} y={CAPTIONS_Y[variant]} tokens={theme.tokens} />
      ) : null}
    </AbsoluteFill>
  );
};

// ---------- subtítulos (los de V0-2/V0-3, más chicos y con fondo para ir encima de la slide) ----

const MAX_WORDS = 4;
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

function Captions({ words, y, tokens }: { words: Word[]; y: number; tokens: StudioTokens }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const lines = toLines(words);
  const line = [...lines].reverse().find((l) => (l[0]?.start ?? 0) <= t) ?? lines[0] ?? [];
  return (
    <div
      style={{
        position: "absolute",
        left: 70,
        right: 150,
        top: y,
        transform: "translateY(-50%)",
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: "8px 16px",
        fontFamily: "'Inter Tight Variable', sans-serif",
      }}
    >
      {line.map((w) => {
        const active = t >= w.start && t < w.end;
        return (
          <span
            key={w.start}
            style={{
              fontSize: 76,
              fontWeight: 800,
              lineHeight: 1.1,
              padding: "4px 14px",
              borderRadius: 12,
              color: active ? tokens.colors.ink : "#FFFFFF",
              backgroundColor: active ? tokens.colors.accent : "rgba(0,0,0,0.55)",
              opacity: t < w.start ? 0.55 : 1,
            }}
          >
            {w.word}
          </span>
        );
      })}
    </div>
  );
}

// ---------- looks-clip ----------

export type ClipScene = { slide: Slide; frames: number; audio?: string; words?: Word[] };
export type LooksClipProps = Common & { variant: Variant; motion: Motion; scenes: ClipScene[] };

export const LooksClip = ({ scenes, ...rest }: LooksClipProps) => {
  const starts = useRef<number[]>([]);
  let from = 0;
  starts.current = scenes.map((s) => {
    const at = from;
    from += s.frames;
    return at;
  });
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {scenes.map((s, i) => (
        <Sequence key={starts.current[i]} from={starts.current[i]} durationInFrames={s.frames}>
          <LookScene
            {...rest}
            slide={s.slide}
            page={{ index: i, total: scenes.length }}
            audio={s.audio}
            words={s.words}
          />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

export { VERTICAL };
