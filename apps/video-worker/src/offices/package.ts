import type { TaskImage } from "@radev/ai";
import {
  buildCredits,
  buildDescription,
  buildShortDescription,
  checkPublication,
  dossierSchema,
  imagesDocSchema,
  type PackageDoc,
  PUBLICATION_RULES,
  publicationSchema,
  sceneStarts,
  scriptSchema,
  smallImagePath,
  thumbnailProps,
  usedImages,
  voiceDocSchema,
} from "@radev/video";
import { failedAi, type Office, OfficeFailure } from "../office";
import type { VideoRenderer } from "../remotion";
import { readDocument } from "./util";

// Oficina 8, Publicación: la IA propone título, gancho, capítulos y miniatura (el código controla que
// la imagen se use en el video, que el texto sea corto y que los capítulos estén separados); el código
// arma las dos descripciones (normal con capítulos, Short con #Shorts), los créditos y las dos
// miniaturas. Todo queda en `package/`, que es lo que baja el operador.

const MAX_ATTEMPTS = 3;

export type PackageDeps = { renderer: Pick<VideoRenderer, "renderStills"> };

export const createPackageOffice =
  (deps: PackageDeps): Office =>
  async (ctx) => {
    const script = await readDocument(ctx, "script", scriptSchema);
    const dossier = await readDocument(ctx, "dossier", dossierSchema);
    const { candidates } = await readDocument(ctx, "images", imagesDocSchema);
    const voice = await readDocument(ctx, "voice", voiceDocSchema);
    const starts = sceneStarts(
      voice.scenes.map((s) => s.frames),
      script.scenes.map((s) => s.tail),
    );

    const used = usedImages(script, candidates);
    const images: TaskImage[] = [];
    for (const c of used) {
      const data = await ctx.files.read(smallImagePath(c.id));
      if (data)
        images.push({
          id: c.id,
          note: `${c.title} (${c.width}x${c.height})`,
          mime: "image/jpeg",
          data,
        });
    }
    const view = {
      title: script.title,
      scenes: script.scenes.map((s, i) => ({
        scene: i + 1,
        image: s.image,
        exact: s.exact,
        narration: s.narration,
      })),
    };

    let problems: string[] = [];
    let previous: unknown;
    let publication: ReturnType<typeof publicationSchema.parse> | undefined;
    let runId: string | undefined;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS && !publication; attempt++) {
      const answer = await ctx.ai.run(ctx.video, {
        task: "video.package",
        prompt:
          attempt === 1
            ? "Preparás la publicación con `guion.json`, `dossier.json` y las imágenes. Devolvé el objeto que pide el schema."
            : `Lo anterior (\`anterior.json\`) tiene errores; devolvé todo corregido:\n${problems.map((p) => `- ${p}`).join("\n")}`,
        files: {
          "CLAUDE.md": PUBLICATION_RULES,
          "guion.json": JSON.stringify(view),
          "dossier.json": JSON.stringify({ topic: dossier.topic, summary: dossier.summary }),
          ...(previous ? { "anterior.json": JSON.stringify(previous) } : {}),
        },
        ...(attempt === 1 ? { images } : {}),
        schema: publicationSchema,
        effort: "low",
        maxTurns: 4,
        timeoutMs: 6 * 60_000,
      });
      if (!answer.ok) {
        if (answer.error.kind === "validation") {
          problems = answer.error.issues;
          continue;
        }
        return failedAi(answer.error, "La publicación");
      }
      previous = answer.data;
      problems = checkPublication(answer.data, script, starts);
      if (problems.length === 0) {
        publication = answer.data;
        runId = answer.runId;
      }
    }
    if (!publication) {
      throw new OfficeFailure(`La publicación no pasó los controles: ${problems.join(" | ")}`);
    }

    const input = { publication, script, candidates, facts: dossier.facts, starts };
    const normal = buildDescription(input);
    const short = buildShortDescription(input);
    const credits = buildCredits(script, candidates);
    await ctx.files.write("package/descripcion.txt", new TextEncoder().encode(normal));
    await ctx.files.write("package/descripcion-short.txt", new TextEncoder().encode(short));
    await ctx.files.write("package/creditos.txt", new TextEncoder().encode(credits));

    const thumb = candidates.find((c) => c.id === publication.thumbnail.image);
    if (!thumb) throw new OfficeFailure("La miniatura usa una imagen que no existe.", false);
    await deps.renderer.renderStills(
      (["9x16", "16x9"] as const).map((format) => ({
        props: thumbnailProps(publication, thumb, format === "16x9" ? "16x9" : "9x16"),
        publicDir: ctx.mediaDir,
        outFile: `${ctx.mediaDir}/package/miniatura-${format}.png`,
      })),
    );

    const doc: PackageDoc = {
      publication,
      descriptionNormal: normal,
      descriptionShort: short,
      credits,
      thumbnails: { "9x16": "package/miniatura-9x16.png", "16x9": "package/miniatura-16x9.png" },
    };
    return {
      kind: "done",
      documents: [{ kind: "package", data: doc, origin: "office", generationRunId: runId }],
    };
  };
