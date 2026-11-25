import { Composition } from "remotion";
import { PHOTO_SIZE, PhotoVideo, type PhotoVideoProps, photoFrames } from "./PhotoVideo";
import { THUMB_SIZE, Thumb, type ThumbProps } from "./Thumb";

const FPS = 30;

/** Las dos composiciones del video documental: el video (`photos`, dos formatos) y la miniatura. */
export const Root = () => (
  <>
    <Composition
      id="photos"
      component={PhotoVideo}
      width={1080}
      height={1920}
      fps={FPS}
      durationInFrames={30 * FPS}
      defaultProps={{ voices: [], shots: [], format: "9x16" } satisfies PhotoVideoProps}
      calculateMetadata={({ props }) => ({
        durationInFrames: Math.max(1, photoFrames(props)),
        ...PHOTO_SIZE[props.format ?? "9x16"],
      })}
    />
    <Composition
      id="thumb"
      component={Thumb}
      width={1280}
      height={720}
      fps={FPS}
      durationInFrames={1}
      defaultProps={
        {
          format: "16x9",
          image: "",
          aspect: 1,
          view: { cx: 0.5, cy: 0.5, vw: 1 },
          kicker: "",
          lines: [],
          accent: "",
        } satisfies ThumbProps
      }
      calculateMetadata={({ props }) => THUMB_SIZE[props.format]}
    />
  </>
);
