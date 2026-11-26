import { type AIError, providerError, rateLimited } from "../errors";

// Voice for the videos (ADR 0027, docs/RADEV-STUDIO-REVISION.md §7). The whole narration goes in
// ONE request (so the intonation does not restart at every scene) and is cut by scene afterwards
// (./split.ts) with the time of each word.

export type TtsWord = { word: string; start: number; end: number };

export type TtsRequest = {
  /** The narration of each scene, in order. They are joined with a space into one take. */
  texts: readonly string[];
  /** The provider's id for the voice (ElevenLabs: `l1zE9xgNpUTaQCZzpNJa`). */
  voiceId: string;
  model?: string;
  /** Null or undefined: the speed saved in the voice. ElevenLabs accepts 0.7 to 1.2. */
  speed?: number | null;
  signal?: AbortSignal;
};

export type TtsResult =
  | {
      ok: true;
      /** The whole take, MP3. Decoding it (ffmpeg) is the worker's job. */
      audio: Buffer;
      mime: "audio/mpeg";
      /** The words of the text, in order, with absolute times in seconds. */
      words: TtsWord[];
      /** Characters sent: what the provider charges credits for. */
      characters: number;
      model: string;
      durationMs: number;
    }
  | { ok: false; error: TtsError };

/** The AI errors plus the two a voice can have that a text model cannot. */
export type TtsError =
  | AIError
  /** The account is out of credits: warn the operator (the local Kokoro is the backup). */
  | { kind: "no_credits"; message: string }
  /** The times do not match the text: the words cannot be cut by scene. */
  | { kind: "alignment"; message: string };

/** The credits of the account's current month. */
export type TtsQuota = { used: number; limit: number; resetsAt: string | null };

export interface TtsProvider {
  readonly id: "elevenlabs";
  synthesize(request: TtsRequest): Promise<TtsResult>;
  /** Null when the provider does not say (e.g. a key without permission). Never throws. */
  quota?(): Promise<TtsQuota | null>;
  /** Public link to a sample of the voice, or null. Never throws. */
  previewUrl?(voiceId: string): Promise<string | null>;
}

export const DEFAULT_TTS_MODEL = "eleven_multilingual_v2";

/** ElevenLabs only accepts a speed between these. */
export const TTS_SPEED_MIN = 0.7;
export const TTS_SPEED_MAX = 1.2;

export const noCredits = (message: string): TtsError => ({ kind: "no_credits", message });
export const alignmentError = (message: string): TtsError => ({ kind: "alignment", message });
export { providerError, rateLimited };
