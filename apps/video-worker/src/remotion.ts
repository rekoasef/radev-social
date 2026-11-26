import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { VideoProbe } from "@radev/video";
import type { PhotoVideoProps, ThumbProps } from "@radev/video/render";
import { bundle } from "@remotion/bundler";
import { openBrowser, renderMedia, renderStill, selectComposition } from "@remotion/renderer";

// The real render (Remotion + Chrome) and the probe (ffprobe), apart from the office so the office
// is tested with fakes. Lessons of V0: Chrome without `font-render-hinting` (the text measures like
// the carousels), 2 browser tabs at once (the notebook's RAM), crf 23, ~4 min for 2 min of video.

export type RenderJob = {
  props: PhotoVideoProps;
  /** The video's media folder: the images and audio are read from it (`staticFile`). */
  publicDir: string;
  /** Absolute path of the MP4. */
  outFile: string;
};

export type StillJob = { props: ThumbProps; publicDir: string; outFile: string };

export type VideoRenderer = {
  /** The thumbnails (PNG), one still each. */
  renderStills(jobs: readonly StillJob[]): Promise<void>;
  /** Renders every job with one bundle and one Chrome. Returns the milliseconds each took. */
  renderAll(
    jobs: readonly RenderJob[],
    onProgress?: (job: number, fraction: number) => void,
  ): Promise<number[]>;
};

export const remotionRenderer: VideoRenderer = {
  async renderStills(jobs) {
    const first = jobs[0];
    if (!first) return;
    const entryPoint = fileURLToPath(import.meta.resolve("@radev/video/render/entry"));
    const serveUrl = await bundle({ entryPoint, publicDir: first.publicDir });
    const browser = await openBrowser("chrome", {
      chromiumOptions: { flags: { "font-render-hinting": false } },
    });
    try {
      for (const job of jobs) {
        const inputProps = job.props as unknown as Record<string, unknown>;
        const composition = await selectComposition({
          serveUrl,
          id: "thumb",
          inputProps,
          puppeteerInstance: browser,
        });
        await mkdir(dirname(job.outFile), { recursive: true });
        await renderStill({
          composition,
          serveUrl,
          inputProps,
          frame: 0,
          output: job.outFile,
          puppeteerInstance: browser,
        });
      }
    } finally {
      await browser.close({ silent: true });
    }
  },

  async renderAll(jobs, onProgress) {
    const first = jobs[0];
    if (!first) return [];
    const entryPoint = fileURLToPath(import.meta.resolve("@radev/video/render/entry"));
    const serveUrl = await bundle({ entryPoint, publicDir: first.publicDir });
    const browser = await openBrowser("chrome", {
      chromiumOptions: { flags: { "font-render-hinting": false } },
    });
    try {
      const times: number[] = [];
      for (const [index, job] of jobs.entries()) {
        const inputProps = job.props as unknown as Record<string, unknown>;
        const composition = await selectComposition({
          serveUrl,
          id: "photos",
          inputProps,
          puppeteerInstance: browser,
        });
        await mkdir(dirname(job.outFile), { recursive: true });
        const started = Date.now();
        await renderMedia({
          composition,
          serveUrl,
          codec: "h264",
          crf: 23,
          outputLocation: job.outFile,
          inputProps,
          concurrency: 2,
          onProgress: ({ progress }) => onProgress?.(index, progress),
          puppeteerInstance: browser,
        });
        times.push(Date.now() - started);
      }
      return times;
    } finally {
      await browser.close({ silent: true });
    }
  },
};

/** Duration, size and bytes of a rendered video (ffprobe). */
export function probeVideo(file: string): Promise<VideoProbe> {
  return new Promise((resolve, reject) => {
    const ffprobe = spawn(
      "ffprobe",
      [
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=width,height:format=duration,size",
        "-of",
        "json",
        file,
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    const out: Buffer[] = [];
    ffprobe.stdout.on("data", (c: Buffer) => out.push(c));
    ffprobe.on("error", (e) => reject(new Error(`No se pudo correr ffprobe: ${e.message}`)));
    ffprobe.on("close", (code) => {
      if (code !== 0) return reject(new Error(`ffprobe terminó con ${code}`));
      try {
        const j = JSON.parse(Buffer.concat(out).toString()) as {
          streams?: { width?: number; height?: number }[];
          format?: { duration?: string; size?: string };
        };
        resolve({
          seconds: Number(j.format?.duration ?? 0),
          width: j.streams?.[0]?.width ?? 0,
          height: j.streams?.[0]?.height ?? 0,
          bytes: Number(j.format?.size ?? 0),
        });
      } catch {
        reject(new Error("ffprobe devolvió una salida ilegible."));
      }
    });
  });
}
