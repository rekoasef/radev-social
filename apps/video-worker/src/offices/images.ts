import {
  buildPool,
  type CommonsClient,
  candidateFromHit,
  compactDossier,
  curatedHits,
  curationView,
  dossierSchema,
  IMAGE_CURATOR_RULES,
  IMAGE_QUERY_RULES,
  imageCurationSchema,
  imageId,
  imageQueriesSchema,
  smallImagePath,
  thumbExtension,
} from "@radev/video";
import { failedAi, type Office } from "../office";
import { readDocument } from "./util";

// Oficina 3, Imágenes: la IA propone consultas, el código busca en Wikimedia Commons (licencias
// libres, con pausas), la IA elige por texto entre ~240 resultados y se bajan las elegidas, cada una
// con una copia chica para que la IA las mire sin gastar de más. Bajar es idempotente: lo que ya
// está en disco no se vuelve a pedir (un reintento no repite el trabajo).

export type ImagesDeps = {
  commons: Pick<CommonsClient, "searchFiles" | "searchCategoryFiles" | "fileByTitle" | "download">;
  /** A 640 px JPEG copy (ffmpeg). */
  shrink(bytes: Uint8Array): Promise<Uint8Array>;
  sizeOf(bytes: Uint8Array): { width: number; height: number } | undefined;
};

export const createImagesOffice =
  (deps: ImagesDeps): Office =>
  async (ctx) => {
    const dossier = await readDocument(ctx, "dossier", dossierSchema);
    const { json } = compactDossier(dossier);

    const queries = await ctx.ai.run(ctx.video, {
      task: "video.images",
      prompt:
        "Leé `dossier.json` y devolvé las consultas de búsqueda de imágenes para Wikimedia Commons.",
      files: { "CLAUDE.md": IMAGE_QUERY_RULES, "dossier.json": json },
      schema: imageQueriesSchema,
      effort: "low",
      maxTurns: 2,
      timeoutMs: 4 * 60_000,
    });
    if (!queries.ok) return failedAi(queries.error, "Las consultas de imágenes");

    const pool = await buildPool(deps.commons, { queries: queries.data.queries }, (m) =>
      ctx.log.info(m),
    );
    ctx.log.info("pool built", { results: pool.length });

    const curation = await ctx.ai.run(ctx.video, {
      task: "video.images",
      prompt:
        "Elegí las imágenes para el video con `resultados.json` y `dossier.json`. Devolvé los `n` elegidos.",
      files: {
        "CLAUDE.md": IMAGE_CURATOR_RULES,
        "dossier.json": json,
        "resultados.json": JSON.stringify(curationView(pool)),
      },
      schema: imageCurationSchema,
      effort: "low",
      maxTurns: 2,
      timeoutMs: 5 * 60_000,
    });
    if (!curation.ok) return failedAi(curation.error, "La curaduría de imágenes");

    const chosen = curatedHits(pool, curation.data.keep);
    const candidates = [];
    for (const [i, hit] of chosen.entries()) {
      const id = imageId(i + 1);
      const file = `images/${id}.${thumbExtension(hit.thumb)}`;
      let bytes = await ctx.files.read(file);
      if (!bytes) {
        bytes = await deps.commons.download(hit.thumb);
        await ctx.files.write(file, bytes);
      }
      if (!(await ctx.files.read(smallImagePath(id)))) {
        await ctx.files.write(smallImagePath(id), await deps.shrink(bytes));
      }
      candidates.push(candidateFromHit(hit, id, file, deps.sizeOf(bytes)));
    }
    ctx.log.info("images ready", { candidates: candidates.length });
    return {
      kind: "done",
      documents: [
        {
          kind: "images",
          data: { candidates },
          origin: "office",
          generationRunId: curation.runId,
        },
      ],
    };
  };
