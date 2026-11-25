import { z } from "zod";
import { type ImageCandidate, licenseAllowed } from "./images";

// Cliente de Wikimedia Commons para la oficina de Imágenes (ADR 0029). Sin archivos: la red
// (`fetch`) y las pausas (`sleep`) se inyectan, así se prueba con respuestas guardadas. Lo que
// aprendió V0: Commons da 429 con tamaños de miniatura que no son los estándar (siempre 1280),
// con consultas de más de 3 palabras casi no encuentra nada, y hay que esperar entre pedidos.

export const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
/** Un User-Agent genérico, sin datos personales (Commons pide que se identifique el cliente). */
export const COMMONS_USER_AGENT = "radev-studio/1 (educational project)";
/** El único ancho de miniatura que Commons sirve sin limitar (otros dan 429). */
export const THUMB_WIDTH = 1280;
export const MIN_WIDTH = 700;
/** Una imagen que el operador pide sí o sí se acepta más chica. */
export const PINNED_MIN_WIDTH = 500;
export const POOL_SIZE = 240;

const FILE_MIME = /^image\/(jpeg|png|webp)$/;

/** Un resultado de Commons ya filtrado (licencia, formato, tamaño) y con su puntaje. */
export type CommonsHit = Omit<ImageCandidate, "id" | "file"> & {
  score: number;
  /** La miniatura de 1280 px que se descarga. */
  thumb: string;
};

const pageSchema = z.object({
  title: z.string(),
  index: z.number().optional(),
  imageinfo: z
    .array(
      z.object({
        mime: z.string(),
        width: z.number(),
        height: z.number(),
        thumburl: z.string().optional(),
        descriptionurl: z.string(),
        extmetadata: z.record(z.string(), z.object({ value: z.unknown() }).partial()).default({}),
      }),
    )
    .optional(),
});
export type CommonsPage = z.infer<typeof pageSchema>;

const responseSchema = z.object({
  query: z.object({ pages: z.record(z.string(), z.unknown()) }).optional(),
});

/** Texto plano de un campo de Commons (que viene con HTML y entidades). */
export const stripHtml = (s: unknown): string =>
  (typeof s === "string" ? s : "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();

const meta = (page: CommonsPage, key: string) => page.imageinfo?.[0]?.extmetadata[key]?.value;

/** El título de un archivo de Commons sin el prefijo `File:` ni la extensión. */
export const cleanTitle = (title: string) => title.replace(/^File:/, "").replace(/\.\w+$/, "");

/**
 * Convierte una página de Commons en un resultado, o null si no sirve: no es JPEG, PNG o WebP, es
 * más angosta que `minWidth`, no trae miniatura o la licencia no se puede usar (sin NC ni ND).
 */
export function parseHit(
  page: CommonsPage,
  options: { minWidth?: number; bonus?: number } = {},
): CommonsHit | null {
  const info = page.imageinfo?.[0];
  if (!info?.thumburl || !FILE_MIME.test(info.mime)) return null;
  if (info.width < (options.minWidth ?? MIN_WIDTH)) return null;
  const license = stripHtml(meta(page, "LicenseShortName"));
  if (!licenseAllowed(license)) return null;
  return {
    title: cleanTitle(page.title),
    description: stripHtml(meta(page, "ImageDescription")).slice(0, 300),
    date: stripHtml(meta(page, "DateTimeOriginal") ?? meta(page, "DateTime")).slice(0, 40),
    author: stripHtml(meta(page, "Artist")).slice(0, 60),
    license,
    page: info.descriptionurl,
    width: info.width,
    height: info.height,
    // el primero de la lista rankea más; las categorías del tema y las fijadas, aún más
    score: 30 - (page.index ?? 15) + (options.bonus ?? 0) + (info.width >= 1200 ? 4 : 0),
    thumb: info.thumburl,
  };
}

/** Suma `hit` al conjunto: si ya estaba, repetirse en otra búsqueda lo sube de puntaje. */
export function addHit(hits: Map<string, CommonsHit>, hit: CommonsHit): boolean {
  const previous = hits.get(hit.page);
  if (previous) {
    previous.score += hit.score + 6;
    return false;
  }
  hits.set(hit.page, hit);
  return true;
}

/** Los mejores `size` resultados, de mayor a menor puntaje. */
export const rankHits = (hits: Iterable<CommonsHit>, size = POOL_SIZE): CommonsHit[] =>
  [...hits].sort((a, b) => b.score - a.score).slice(0, size);

export class CommonsError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "CommonsError";
  }
}

export type CommonsOptions = {
  /** Default: global fetch. */
  fetch?: typeof fetch;
  /** Default: setTimeout. Se inyecta en los tests para no esperar. */
  sleep?: (ms: number) => Promise<void>;
  userAgent?: string;
  /** Pausa antes de cada pedido a la API (default 1,5 s) y de cada descarga (default 3 s). */
  apiPauseMs?: number;
  downloadPauseMs?: number;
  /** Espera base entre reintentos: crece 1×, 2×, 3×… (default 15 s para la API, 20 s para bajar). */
  retryBaseMs?: number;
  downloadRetryBaseMs?: number;
  apiAttempts?: number;
  downloadAttempts?: number;
};

export type CommonsClient = ReturnType<typeof createCommonsClient>;

export function createCommonsClient(options: CommonsOptions = {}) {
  const doFetch = options.fetch ?? fetch;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const headers = { "User-Agent": options.userAgent ?? COMMONS_USER_AGENT };
  const apiPause = options.apiPauseMs ?? 1500;
  const downloadPause = options.downloadPauseMs ?? 3000;
  const retryBase = options.retryBaseMs ?? 15_000;
  const downloadRetryBase = options.downloadRetryBaseMs ?? 20_000;
  const apiAttempts = options.apiAttempts ?? 4;
  const downloadAttempts = options.downloadAttempts ?? 5;
  const info = {
    prop: "imageinfo",
    iiprop: "url|extmetadata|size|mime",
    iiurlwidth: String(THUMB_WIDTH),
  };

  /** Un pedido a la API, con pausa antes y reintentos con espera creciente. */
  async function query(params: Record<string, string>): Promise<CommonsPage[]> {
    const url = `${COMMONS_API}?${new URLSearchParams({ format: "json", ...params })}`;
    await sleep(apiPause);
    let last = 0;
    for (let i = 0; i < apiAttempts; i++) {
      const response = await doFetch(url, { headers });
      if (response.ok) {
        const parsed = responseSchema.safeParse(await response.json());
        if (!parsed.success) throw new CommonsError("Commons respondió con un formato inesperado.");
        return Object.values(parsed.data.query?.pages ?? {}).flatMap((p) => {
          const page = pageSchema.safeParse(p);
          return page.success ? [page.data] : [];
        });
      }
      last = response.status;
      if (i < apiAttempts - 1) await sleep(retryBase * (i + 1));
    }
    throw new CommonsError(`Commons no responde (último estado ${last}).`, last);
  }

  return {
    query,

    /** Archivos que coinciden con una consulta (Commons exige todas las palabras: 1 a 3). */
    async searchFiles(q: string, bonus = 0, limit = 30): Promise<CommonsHit[]> {
      const pages = await query({
        action: "query",
        generator: "search",
        gsrsearch: q,
        gsrnamespace: "6",
        gsrlimit: String(limit),
        ...info,
      });
      return pages.flatMap((p) => parseHit(p, { bonus }) ?? []);
    },

    /** Archivos de las categorías de Commons sobre el tema (juntan justo lo que sirve). */
    async searchCategoryFiles(q: string, bonus = 8): Promise<CommonsHit[]> {
      const cats = await query({
        action: "query",
        generator: "search",
        gsrsearch: q,
        gsrnamespace: "14",
        gsrlimit: "2",
      });
      const hits: CommonsHit[] = [];
      for (const cat of cats) {
        const pages = await query({
          action: "query",
          generator: "categorymembers",
          gcmtitle: cat.title,
          gcmtype: "file",
          gcmlimit: "40",
          ...info,
        });
        hits.push(...pages.flatMap((p) => parseHit(p, { bonus }) ?? []));
      }
      return hits;
    },

    /** Un archivo por su nombre (el operador lo pide). Acepta imágenes más chicas. */
    async fileByTitle(title: string, bonus = 100): Promise<CommonsHit | null> {
      const pages = await query({
        action: "query",
        titles: `File:${title.replace(/^File:/, "")}`,
        ...info,
      });
      const page = pages[0];
      return page ? parseHit(page, { minWidth: PINNED_MIN_WIDTH, bonus }) : null;
    },

    /** Baja una imagen con pausa antes y reintentos con espera creciente. */
    async download(url: string): Promise<Buffer> {
      await sleep(downloadPause);
      let last = 0;
      for (let i = 0; i < downloadAttempts; i++) {
        const response = await doFetch(url, { headers });
        if (response.ok) return Buffer.from(await response.arrayBuffer());
        last = response.status;
        if (i < downloadAttempts - 1) await sleep(downloadRetryBase * (i + 1));
      }
      throw new CommonsError(`No se pudo bajar la imagen (último estado ${last}).`, last);
    },
  };
}

/** Las primeras consultas (el hecho central) también buscan en las categorías del tema. */
export const CATEGORY_QUERIES = 10;

export type PoolProgress = (message: string) => void;

/**
 * El conjunto de resultados para curar: cada consulta suma archivos (y, las primeras 10, también los
 * de sus categorías), las imágenes fijadas entran con bonus 100. Devuelve los 240 mejores.
 */
export async function buildPool(
  client: Pick<CommonsClient, "searchFiles" | "searchCategoryFiles" | "fileByTitle">,
  input: { queries: readonly string[]; pins?: readonly string[] },
  progress: PoolProgress = () => {},
): Promise<CommonsHit[]> {
  const hits = new Map<string, CommonsHit>();
  for (const [n, q] of input.queries.entries()) {
    let found = 0;
    for (const hit of await client.searchFiles(q)) if (addHit(hits, hit)) found++;
    let fromCats = 0;
    if (n < CATEGORY_QUERIES) {
      for (const hit of await client.searchCategoryFiles(q)) if (addHit(hits, hit)) fromCats++;
    }
    progress(`«${q}»: ${found} nuevas${fromCats ? ` + ${fromCats} de categorías` : ""}`);
  }
  for (const title of input.pins ?? []) {
    const hit = await client.fileByTitle(title);
    if (hit) addHit(hits, hit);
    progress(`fijada «${title}»: ${hit ? "ok" : "no existe o no sirve (licencia o tamaño)"}`);
  }
  return rankHits(hits.values());
}

/** Una candidata a partir de un resultado: el id lo da el orden y el archivo, la oficina. */
export function candidateFromHit(
  hit: CommonsHit,
  id: string,
  file: string,
  size?: { width: number; height: number },
): ImageCandidate {
  const { score: _score, thumb: _thumb, ...rest } = hit;
  return { ...rest, id, file, width: size?.width ?? hit.width, height: size?.height ?? hit.height };
}

/** `i01`, `i02`… (el guion los pide con `^i\d{2,3}$`). */
export const imageId = (n: number) => `i${String(n).padStart(2, "0")}`;

/** La extensión del archivo de una miniatura de Commons (por defecto `jpg`). */
export function thumbExtension(url: string): "jpg" | "png" | "webp" {
  const ext = url.match(/\.(jpe?g|png|webp)(\?|$)/i)?.[1]?.toLowerCase();
  return ext === "png" || ext === "webp" ? ext : "jpg";
}
