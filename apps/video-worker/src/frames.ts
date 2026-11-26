import {
  FRAME_FORMATS,
  type FrameFormat,
  framePath,
  frameProps,
  type ImageCandidate,
  type Script,
  sceneFrames,
} from "@radev/video";
import type { StillJob, VideoRenderer } from "./remotion";

// The still frame of every scene, as it will come out (docs/VIDEO-CALIDAD.md). Named by content:
// only the scenes that changed are drawn again, so running it twice draws nothing (rule 8).

export type FramesDeps = {
  renderer: Pick<VideoRenderer, "renderStills">;
  /** Whether a file of the video's folder exists. */
  exists(path: string): Promise<boolean>;
  /** Absolute path of the video's folder. */
  mediaDir: string;
};

export type DrawnFrame = {
  scene: number;
  candidate: ImageCandidate;
  files: Record<FrameFormat, string>;
};

export async function drawFrames(
  deps: FramesDeps,
  script: Script,
  candidates: ImageCandidate[],
): Promise<{ frames: DrawnFrame[]; drawn: number }> {
  const frames: DrawnFrame[] = [];
  const jobs: StillJob[] = [];
  for (const { scene, key, candidate } of sceneFrames(script, candidates)) {
    const source = script.scenes[scene - 1];
    if (!source) continue;
    const files = {} as Record<FrameFormat, string>;
    for (const format of FRAME_FORMATS) {
      const path = framePath(key, format);
      files[format] = path;
      if (!(await deps.exists(path))) {
        jobs.push({
          composition: "frame",
          props: frameProps(source, candidate, format),
          publicDir: deps.mediaDir,
          outFile: `${deps.mediaDir}/${path}`,
        });
      }
    }
    frames.push({ scene, candidate, files });
  }
  if (jobs.length > 0) await deps.renderer.renderStills(jobs);
  return { frames, drawn: jobs.length };
}
