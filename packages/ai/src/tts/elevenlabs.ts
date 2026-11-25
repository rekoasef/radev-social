import { providerError, rateLimited } from "../errors";
import {
  alignmentError,
  DEFAULT_TTS_MODEL,
  noCredits,
  TTS_SPEED_MAX,
  TTS_SPEED_MIN,
  type TtsError,
  type TtsProvider,
  type TtsRequest,
  type TtsResult,
} from "./types";
import { type CharAlignment, countWords, wordsFromChars } from "./words";

const BASE_URL = "https://api.elevenlabs.io";
export const DEFAULT_TTS_TIMEOUT_MS = 5 * 60_000;

export type ElevenLabsOptions = {
  /** Default: ELEVENLABS_API_KEY from the environment (never logged, rule 10). */
  apiKey?: string;
  env?: NodeJS.ProcessEnv;
  /** For tests. Default: global fetch. */
  fetch?: typeof fetch;
  timeoutMs?: number;
};

/** ElevenLabs answers errors as `{ detail: { status, message } }` or `{ detail: "text" }`. */
function detailOf(body: string): { status: string; message: string } {
  try {
    const parsed = JSON.parse(body) as { detail?: unknown };
    const d = parsed.detail;
    if (typeof d === "string") return { status: "", message: d };
    if (d && typeof d === "object") {
      const o = d as { status?: unknown; message?: unknown };
      return {
        status: typeof o.status === "string" ? o.status : "",
        message: typeof o.message === "string" ? o.message : body,
      };
    }
  } catch {
    // not JSON: use the text as is
  }
  return { status: "", message: body };
}

/** Maps an ElevenLabs failure to a typed error (credits, credential, limit, bad input, other). */
export function classifyElevenLabsError(status: number, body: string): TtsError {
  const { status: code, message } = detailOf(body);
  const detail = message.trim().slice(0, 300) || "sin detalle";
  if (code === "quota_exceeded" || /quota|credits/i.test(code)) {
    return noCredits(`ElevenLabs se quedó sin créditos: ${detail}`);
  }
  if (status === 429) return rateLimited(`ElevenLabs pidió esperar (429): ${detail}`);
  if (status === 401 || status === 403) {
    return providerError(
      `ElevenLabs rechazó la credencial. Revisá ELEVENLABS_API_KEY: ${detail}`,
      false,
    );
  }
  if (status === 402) {
    return providerError(
      `La voz o la función no está incluida en tu plan de ElevenLabs: ${detail}`,
      false,
    );
  }
  if (status === 400 || status === 404 || status === 422) {
    return providerError(`ElevenLabs no aceptó el pedido (${status}): ${detail}`, false);
  }
  return providerError(`ElevenLabs respondió ${status}: ${detail}`, status >= 500);
}

export function createElevenLabsProvider(options: ElevenLabsOptions = {}): TtsProvider | null {
  const apiKey = options.apiKey ?? (options.env ?? process.env).ELEVENLABS_API_KEY;
  if (!apiKey) return null;
  const doFetch = options.fetch ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TTS_TIMEOUT_MS;

  async function call(
    path: string,
    init: RequestInit,
    signal: AbortSignal | undefined,
  ): Promise<{ ok: true; text: string } | { ok: false; error: TtsError }> {
    const timeout = AbortSignal.timeout(timeoutMs);
    let response: Response;
    try {
      response = await doFetch(`${BASE_URL}${path}`, {
        ...init,
        headers: { "xi-api-key": apiKey as string, ...(init.headers ?? {}) },
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        error: providerError(`No se pudo conectar con ElevenLabs: ${reason}`, true),
      };
    }
    const text = await response.text();
    if (!response.ok) return { ok: false, error: classifyElevenLabsError(response.status, text) };
    return { ok: true, text };
  }

  return {
    id: "elevenlabs",
    async synthesize(request: TtsRequest): Promise<TtsResult> {
      const started = Date.now();
      const model = request.model ?? DEFAULT_TTS_MODEL;
      const texts = request.texts.map((t) => t.trim()).filter(Boolean);
      if (texts.length === 0) {
        return { ok: false, error: providerError("No hay texto para la voz.", false) };
      }
      const speed = request.speed ?? null;
      if (speed !== null && (speed < TTS_SPEED_MIN || speed > TTS_SPEED_MAX)) {
        return {
          ok: false,
          error: providerError(
            `La velocidad de la voz tiene que estar entre ${TTS_SPEED_MIN} y ${TTS_SPEED_MAX}.`,
            false,
          ),
        };
      }
      const text = texts.join(" ");
      const voice = encodeURIComponent(request.voiceId);
      const body: Record<string, unknown> = { text, model_id: model };

      if (speed !== null) {
        // The saved settings go along with the speed: sent alone, the rest would go back to the
        // defaults (ADR 0027).
        const stored = await call(
          `/v1/voices/${voice}/settings`,
          { method: "GET" },
          request.signal,
        );
        if (!stored.ok) return stored;
        try {
          body.voice_settings = { ...(JSON.parse(stored.text) as object), speed };
        } catch {
          return {
            ok: false,
            error: providerError("ElevenLabs devolvió ajustes ilegibles.", true),
          };
        }
      }

      const made = await call(
        `/v1/text-to-speech/${voice}/with-timestamps`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
        request.signal,
      );
      if (!made.ok) return made;

      let data: { audio_base64?: string; alignment?: CharAlignment | null };
      try {
        data = JSON.parse(made.text) as typeof data;
      } catch {
        return {
          ok: false,
          error: providerError("ElevenLabs devolvió una respuesta ilegible.", true),
        };
      }
      if (!data.audio_base64 || !data.alignment) {
        return {
          ok: false,
          error: providerError("ElevenLabs respondió sin audio o sin tiempos.", true),
        };
      }
      const words = wordsFromChars(data.alignment);
      const expected = texts.reduce((n, t) => n + countWords(t), 0);
      if (words.length !== expected) {
        return {
          ok: false,
          error: alignmentError(
            `Los tiempos traen ${words.length} palabras y el texto ${expected}: no se puede cortar por escena.`,
          ),
        };
      }
      return {
        ok: true,
        audio: Buffer.from(data.audio_base64, "base64"),
        mime: "audio/mpeg",
        words,
        characters: text.length,
        model,
        durationMs: Date.now() - started,
      };
    },
  };
}
