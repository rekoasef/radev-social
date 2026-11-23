import { Composition } from "remotion";
import { Captions, type CaptionsProps } from "./Captions";
import { FPS, HEIGHT, Short, type ShortProps, WIDTH } from "./Short";

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
  </>
);
