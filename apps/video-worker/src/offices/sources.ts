import {
  betterFind,
  checkSources,
  dossierSchema,
  type FoundQuote,
  foundQuotesSchema,
  pageChunks,
  pageForQuotes,
  readablePage,
  SOURCES_RULES,
  sourceItems,
  verifiedQuote,
} from "@radev/video";
import { failedAi, type Office } from "../office";
import { readDocument } from "./util";

// Oficina 2, Fuentes: el código baja cada página del dossier. Lo que no aparece textual en ella (la
// búsqueda de Investigación le pasa a la IA un resumen, no la página), lo busca una IA leyendo el
// texto real: copia la frase que lo respalda y el código comprueba que esté. Lo que la página no
// dice no llega al Guion ni a la Verificación (`usableDossier`; docs/VIDEO-CALIDAD.md, etapa 4).

export type SourcesDeps = {
  /** The HTML of a page; throws with a short message (`HTTP 403`, `timeout`) when it cannot. */
  fetchPage(url: string): Promise<string>;
};

export const createSourcesOffice =
  (deps: SourcesDeps): Office =>
  async (ctx) => {
    const dossier = await readDocument(ctx, "dossier", dossierSchema);
    const items = sourceItems(dossier);
    const pages = new Map<string, string | Error>();
    for (const url of new Set(items.map((f) => f.url))) {
      try {
        pages.set(url, await deps.fetchPage(url));
      } catch (error) {
        pages.set(url, error instanceof Error ? error : new Error(String(error)));
      }
    }

    // What the code alone cannot find, an AI looks for in the page itself.
    const first = checkSources(dossier, pages);
    const pending = new Set(
      first.facts.filter((f) => f.result === "casi" || f.result === "no-esta").map((f) => f.id),
    );
    const found = new Map<string, FoundQuote & { verified: boolean }>();
    const cut = new Set<string>();
    for (const [url, html] of pages) {
      const asked = items.filter((f) => f.url === url && pending.has(f.id));
      if (html instanceof Error || asked.length === 0) continue;
      const page = readablePage(html);
      if (page.cut) cut.add(url);
      const normalized = pageForQuotes(html);
      const chunks = pageChunks(page.text);
      // A long page goes in parts: in one huge text the AI misses things. Each part only asks for
      // what is still missing, and the first sentence that is really on the page wins.
      for (const [n, chunk] of chunks.entries()) {
        // still to find: not found at all, or only in part
        const missing = asked.filter((f) => {
          const current = found.get(f.id);
          return !current?.verified || current.differs !== null;
        });
        if (missing.length === 0) break;
        await ctx.progress({
          detail: `Buscando ${missing.length} hechos en ${new URL(url).hostname}${chunks.length > 1 ? ` (parte ${n + 1} de ${chunks.length})` : ""}`,
        });
        const answer = await ctx.ai.run(ctx.video, {
          task: "video.sources",
          prompt:
            "Buscá en `pagina.txt` la frase que respalda cada afirmación de `hechos.json` y devolvé el objeto que pide el schema.",
          files: {
            "CLAUDE.md": SOURCES_RULES,
            "pagina.txt": chunk,
            "hechos.json": JSON.stringify(missing.map(({ id, claim }) => ({ id, claim }))),
          },
          schema: foundQuotesSchema,
          effort: "low",
          maxTurns: 2,
          timeoutMs: 5 * 60_000,
        });
        if (!answer.ok) {
          // Claude's limit pauses the video; anything else leaves these facts as the code saw them.
          if (answer.error.kind === "rate_limited") return failedAi(answer.error, "Fuentes");
          ctx.log.warn("page part not read by the AI", {
            url,
            part: n + 1,
            error: answer.error.message,
          });
          continue;
        }
        const ids = new Set(missing.map((f) => f.id));
        for (const { id, quotes, differs } of answer.data.items) {
          if (!ids.has(id)) continue;
          const next = { quotes, differs, verified: verifiedQuote(quotes, normalized) !== null };
          // whole beats partial, a sentence the page really has beats a "not here" or an invented one
          if (betterFind(found.get(id), next)) found.set(id, next);
        }
      }
    }

    const doc = checkSources(dossier, pages, found, cut);
    ctx.log.info("sources checked", { ...doc.summary, readByAi: found.size });
    return { kind: "done", documents: [{ kind: "sources", data: doc, origin: "office" }] };
  };
