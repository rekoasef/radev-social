import { exampleSlides, FORMAT } from "@radev/slides";
import { Composition } from "remotion";
import { AnimVideo, type AnimVideoProps, animFrames } from "./anim/AnimVideo";
import { StudioSheet, type StudioSheetProps, sheetHeight } from "./anim/studio-draw";
import { Captions, type CaptionsProps, Scene, type SceneProps } from "./Captions";
import { clipSlides } from "./looks/clip-slides";
import {
  LookScene,
  type LookSceneProps,
  LooksClip,
  type LooksClipProps,
  SlideStill,
  type SlideStillProps,
} from "./looks/Looks";
import { FPS, HEIGHT, Short, type ShortProps, WIDTH } from "./Short";

const radev = { colors: { ink: "#0B0B0B", accent: "#FF7A00" } };

// Una composición: el Short de prueba de V0-1. La duración llega por props
// (30 s para el barrido de concurrency, 45 s para el criterio de éxito).
export const Root = () => (
  <>
    <Composition
      id="short"
      component={Short}
      width={WIDTH}
      height={HEIGHT}
      fps={FPS}
      durationInFrames={30 * FPS}
      defaultProps={{ seconds: 30 } satisfies ShortProps}
      calculateMetadata={({ props }) => ({ durationInFrames: props.seconds * FPS })}
    />
    {/* V0-2: voz + subtítulos palabra por palabra. */}
    <Composition
      id="captions"
      component={Captions}
      width={WIDTH}
      height={HEIGHT}
      fps={FPS}
      durationInFrames={30 * FPS}
      defaultProps={{ audio: "", words: [], seconds: 30 } satisfies CaptionsProps}
      calculateMetadata={({ props }) => ({ durationInFrames: Math.ceil(props.seconds * FPS) })}
    />
    {/* V0-3: una escena; su largo en cuadros exactos llega por props. */}
    <Composition
      id="scene"
      component={Scene}
      width={WIDTH}
      height={HEIGHT}
      fps={FPS}
      durationInFrames={30}
      defaultProps={
        { audio: "", words: [], frames: 30, bg: "#0E0F12", label: "" } satisfies SceneProps
      }
      calculateMetadata={({ props }) => ({ durationInFrames: props.frames })}
    />
    {/* V0-5: los looks de @radev/slides. Un cuadro por slide, al tamaño del carrusel. */}
    <Composition
      id="look-still"
      component={SlideStill}
      width={FORMAT.width}
      height={FORMAT.height}
      fps={FPS}
      durationInFrames={1}
      defaultProps={
        {
          look: "editorial",
          tokens: radev,
          seed: "preview",
          brandName: "Marca",
          slides: [exampleSlides.cover],
        } satisfies SlideStillProps
      }
      calculateMetadata={({ props }) => ({ durationInFrames: props.slides.length })}
    />
    <Composition
      id="look-scene"
      component={LookScene}
      width={WIDTH}
      height={HEIGHT}
      fps={FPS}
      durationInFrames={2 * FPS}
      defaultProps={
        {
          look: "editorial",
          tokens: radev,
          seed: "v0-5",
          brandName: "RAdev",
          slide: exampleSlides.steps,
          page: { index: 2, total: 6 },
          variant: "b",
          motion: "stagger",
        } satisfies LookSceneProps
      }
    />
    <Composition
      id="looks-clip"
      component={LooksClip}
      width={WIDTH}
      height={HEIGHT}
      fps={FPS}
      durationInFrames={1}
      defaultProps={
        {
          look: "editorial",
          tokens: radev,
          seed: "v0-5",
          brandName: "RAdev",
          variant: "b",
          motion: "stagger",
          scenes: clipSlides.map((slide) => ({ slide, frames: 2 * FPS })),
        } satisfies LooksClipProps
      }
      calculateMetadata={({ props }) => ({
        durationInFrames: props.scenes.reduce((sum, s) => sum + s.frames, 0),
      })}
    />
    {/* Video animado guionado escena por escena (V0-6 redefinida). */}
    <Composition
      id="anim"
      component={AnimVideo}
      width={WIDTH}
      height={HEIGHT}
      fps={FPS}
      durationInFrames={1}
      defaultProps={{ voices: [] } satisfies AnimVideoProps}
      calculateMetadata={({ props }) => ({ durationInFrames: Math.max(1, animFrames(props)) })}
    />
    {/* Estudio (ADR 0028): hoja con las piezas dibujadas por la IA, para aprobarlas. */}
    <Composition
      id="studio-sheet"
      component={StudioSheet}
      width={WIDTH}
      height={HEIGHT}
      fps={FPS}
      durationInFrames={60}
      defaultProps={{ items: [] } satisfies StudioSheetProps}
      calculateMetadata={({ props }) => ({ height: sheetHeight(props.items.length) })}
    />
  </>
);
