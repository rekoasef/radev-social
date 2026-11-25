import {
  checkRenderQuality,
  imagesDocSchema,
  RENDER_FORMATS,
  type RenderDoc,
  scriptSchema,
  shortCredit,
  VIDEO_SIZES,
  type VideoProbe,
  videoFrames,
  voiceDocSchema,
} from "@radev/video";
import type { PhotoVideoProps } from "@radev/video/render";
import { type Office, OfficeFailure } from "../office";
import type { RenderJob, VideoRenderer } from "../remotion";
import { readDocument } from "./util";

// Oficina 7, Render: Remotion renderiza el video ENTERO en los dos formatos (Short 9:16 y normal
// 16:9) con las imágenes, la voz y los gráficos del guion, y el control de calidad mira largo y
// medidas de cada MP4. Las imágenes y el audio se leen directo de la carpeta del video.

export type RenderDeps = {
  renderer: VideoRenderer;
  probe(file: string): Promise<VideoProbe>;
};

export const createRenderOffice =
  (deps: RenderDeps): Office =>
  async (ctx) => {
    const script = await readDocument(ctx, "script", scriptSchema);
    const { candidates } = await readDocument(ctx, "images", imagesDocSchema);
    const voice = await readDocument(ctx, "voice", voiceDocSchema);
    if (voice.scenes.length !== script.scenes.length) {
      throw new OfficeFailure(
        `El guion tiene ${script.scenes.length} escenas y la voz ${voice.scenes.length}: rehacé la locución.`,
        false,
      );
    }

    const voices: PhotoVideoProps["voices"] = [];
    for (const scene of voice.scenes) {
      const raw = await ctx.files.read(scene.words);
      if (!raw) throw new OfficeFailure(`Falta ${scene.words}: rehacé la locución.`, false);
      voices.push({
        audio: scene.audio,
        words: JSON.parse(new TextDecoder().decode(raw)),
        frames: scene.frames,
      });
    }
    const shots: PhotoVideoProps["shots"] = script.scenes.map((s, i) => {
      const c = candidates.find((x) => x.id === s.image);
      if (!c)
        throw new OfficeFailure(
          `La escena ${i + 1} usa una imagen que no existe (${s.image}).`,
          false,
        );
      return {
        voice: i,
        image: c.file,
        aspect: c.height / c.width,
        from: s.from,
        to: s.to,
        credit: shortCredit(c, s.caption),
        highlight: s.highlight,
        graphics: s.graphics,
        tail: s.tail,
      };
    });

    const expectedFrames = videoFrames(
      voice.scenes.map((s) => s.frames),
      script.scenes.map((s) => s.tail),
    );
    const jobs: RenderJob[] = RENDER_FORMATS.map((format) => ({
      props: { voices, shots, format },
      publicDir: ctx.mediaDir,
      outFile: `${ctx.mediaDir}/render/video-${format}.mp4`,
    }));
    ctx.log.info("rendering both formats", { frames: expectedFrames });
    const times = await deps.renderer.renderAll(jobs);

    const doc: RenderDoc = { fps: 30, totalFrames: expectedFrames, formats: [] };
    const problems: string[] = [];
    for (const [i, format] of RENDER_FORMATS.entries()) {
      const job = jobs[i];
      if (!job) continue;
      const probe = await deps.probe(job.outFile);
      const errors = checkRenderQuality(format, probe, expectedFrames);
      problems.push(...errors.map((e) => `${format}: ${e}`));
      doc.formats.push({
        format,
        file: `render/video-${format}.mp4`,
        seconds: Math.round(probe.seconds * 100) / 100,
        bytes: probe.bytes,
        width: VIDEO_SIZES[format].width,
        height: VIDEO_SIZES[format].height,
        renderMs: times[i] ?? 0,
      });
    }
    if (problems.length > 0) {
      throw new OfficeFailure(
        `El video no pasó el control de calidad: ${problems.join(" | ")}`,
        true,
      );
    }
    return {
      kind: "done",
      documents: [{ kind: "render", data: doc, origin: "office" }],
      usage: [
        {
          kind: "render",
          quantity: Math.round(times.reduce((a, b) => a + b, 0) / 1000),
          unit: "seconds",
        },
      ],
    };
  };
