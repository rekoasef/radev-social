import { checkSources, dossierSchema } from "@radev/video";
import type { Office } from "../office";
import { readDocument } from "./util";

// Oficina 2, Fuentes (solo código): baja cada página del dossier y mide cuánto del fragmento
// «textual» está en ella. En V1 es informativo: lo ve el operador en su escritorio.

export type SourcesDeps = {
  /** The HTML of a page; throws with a short message (`HTTP 403`, `timeout`) when it cannot. */
  fetchPage(url: string): Promise<string>;
};

export const createSourcesOffice =
  (deps: SourcesDeps): Office =>
  async (ctx) => {
    const dossier = await readDocument(ctx, "dossier", dossierSchema);
    const pages = new Map<string, string | Error>();
    for (const url of new Set(dossier.facts.map((f) => f.url))) {
      try {
        pages.set(url, await deps.fetchPage(url));
      } catch (error) {
        pages.set(url, error instanceof Error ? error : new Error(String(error)));
      }
    }
    const doc = checkSources(dossier, pages);
    ctx.log.info("sources checked", doc.summary);
    return { kind: "done", documents: [{ kind: "sources", data: doc, origin: "office" }] };
  };
