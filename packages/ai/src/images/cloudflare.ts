import { type AIError, providerError, rateLimited } from "../errors";

// Image generation with Cloudflare Workers AI (ADR 0016): FLUX.1 schnell, inside the free daily
// allocation (10,000 neurons; ~96 per 1024×1024 image at 8 steps). Only the worker calls it
// (rule 5). The token goes in a header and nowhere else: never in logs or error messages.

export const CLOUDFLARE_IMAGE_MODEL = "@cf/black-forest-labs/flux-1-schnell";
export const DEFAULT_IMAGE_STEPS = 8;
export const DEFAULT_IMAGE_TIMEOUT_MS = 60_000;
/** FLUX.1 schnell's cap on the prompt. */
export const MAX_IMAGE_PROMPT = 2048;

export type ImageRequest = {
  prompt: string;
  /** 1–8; more is more detail. FLUX.1 schnell takes no seed: each call is a new image. */
  steps?: number;
  signal?: AbortSignal;
};

export type ImageResult =
  | { ok: true; image: Buffer; mime: "image/jpeg"; model: string; durationMs: number }
  | { ok: false; error: AIError };

export interface ImageProvider {
  readonly id: "cloudflare";
  generate(request: ImageRequest): Promise<ImageResult>;
}

export type CloudflareImageOptions = {
  /** Environment to read CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN from. */
  env?: NodeJS.ProcessEnv;
  /** For tests. Default: global fetch. */
  fetch?: typeof fetch;
  timeoutMs?: number;
};

type Envelope = {
  success?: boolean;
  result?: { image?: string } | null;
  errors?: { code?: number; message?: string }[];
};

/** The credentials, or null when either is missing (then there are no images, no error). */
export function cloudflareCredentials(
  env: NodeJS.ProcessEnv,
): { accountId: string; token: string } | null {
  const accountId = env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const token = env.CLOUDFLARE_API_TOKEN?.trim();
  return accountId && token ? { accountId, token } : null;
}

/** Error of an HTTP status or of `errors` in the answer. */
export function classifyCloudflareError(status: number, message: string): AIError {
  const detail = message.trim().slice(0, 300) || "sin detalle";
  // The daily allocation used up comes as 429 (or a message about the limit).
  if (status === 429 || /limit|quota|neurons/i.test(detail)) {
    return rateLimited(`Cloudflare llegó al límite de uso (cupo diario): ${detail}`);
  }
  if (status === 401 || status === 403) {
    return providerError(
      `Cloudflare rechazó la credencial. Revisá CLOUDFLARE_API_TOKEN y CLOUDFLARE_ACCOUNT_ID: ${detail}`,
      false,
    );
  }
  if (status === 408 || status >= 500) {
    return providerError(`Cloudflare falló (HTTP ${status}): ${detail}`, true);
  }
  return providerError(`Cloudflare devolvió HTTP ${status}: ${detail}`, false);
}

/** Null when the credentials are not set: the brand's posts go without images. */
export function createCloudflareImageProvider(
  options: CloudflareImageOptions = {},
): ImageProvider | null {
  const credentials = cloudflareCredentials(options.env ?? process.env);
  if (!credentials) return null;
  const doFetch = options.fetch ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_IMAGE_TIMEOUT_MS;
  const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(credentials.accountId)}/ai/run/${CLOUDFLARE_IMAGE_MODEL}`;

  return {
    id: "cloudflare",
    async generate(request) {
      const startedAt = Date.now();
      const timeout = AbortSignal.timeout(timeoutMs);
      const signal = request.signal ? AbortSignal.any([request.signal, timeout]) : timeout;
      let response: Response;
      try {
        response = await doFetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${credentials.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt: request.prompt.slice(0, MAX_IMAGE_PROMPT),
            steps: request.steps ?? DEFAULT_IMAGE_STEPS,
          }),
          signal,
        });
      } catch (error) {
        const aborted = error instanceof Error && error.name === "TimeoutError";
        return {
          ok: false,
          error: providerError(
            aborted
              ? `Cloudflare no respondió en ${Math.round(timeoutMs / 1000)} s.`
              : `No se pudo llamar a Cloudflare (${error instanceof Error ? error.message : "error de red"}).`,
            true,
          ),
        };
      }

      let body: Envelope | null = null;
      try {
        body = (await response.json()) as Envelope;
      } catch {
        body = null;
      }
      const message = body?.errors?.map((e) => e.message ?? "").join(" · ") ?? "";
      if (!response.ok || !body?.success) {
        return { ok: false, error: classifyCloudflareError(response.status, message) };
      }
      const base64 = body.result?.image;
      if (!base64) {
        return { ok: false, error: providerError("Cloudflare respondió sin imagen.", true) };
      }
      return {
        ok: true,
        image: Buffer.from(base64, "base64"),
        mime: "image/jpeg",
        model: CLOUDFLARE_IMAGE_MODEL,
        durationMs: Date.now() - startedAt,
      };
    },
  };
}
