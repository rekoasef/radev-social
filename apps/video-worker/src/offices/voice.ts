import {
  DEFAULT_TTS_MODEL,
  SAMPLE_RATE,
  splitScenes,
  type TtsError,
  type TtsProvider,
  VIDEO_FPS,
  wavFromPcm,
} from "@radev/ai";
import { canReuseVoice, type VoiceInput, voiceFingerprint } from "@radev/core";
import { scriptSchema, type VoiceDoc, voiceDocSchema } from "@radev/video";
import { type Office, OfficeFailure, type OfficeResult } from "../office";
import { readDocument } from "./util";

// Oficina 6, Locución: toda la narración en UN pedido a ElevenLabs (la entonación no se corta entre
// escenas), cortada por escena con los tiempos de las palabras. La voz se paga: si el texto, la voz,
// el modelo y la velocidad no cambiaron desde la última vez, se reutiliza el audio que ya está.

export type VoiceDeps = {
  /** Null without ELEVENLABS_API_KEY: the office then fails saying so. */
  tts: TtsProvider | null;
  /** The take (MP3) as mono 16-bit PCM at 48 kHz (ffmpeg). */
  decode(audio: Uint8Array): Promise<Int16Array>;
};

const sceneName = (i: number) => `s${String(i).padStart(2, "0")}`;

/** What a TTS failure means for the video: the limit waits, no credits needs the operator. */
function failedTts(error: TtsError): OfficeResult {
  switch (error.kind) {
    case "rate_limited":
      return { kind: "rate_limited", retryAfterMs: error.retryAfterMs };
    case "no_credits":
      return { kind: "pause", reason: "budget", message: error.message };
    case "alignment":
      throw new OfficeFailure(`La voz: ${error.message}`, true);
    case "validation":
      throw new OfficeFailure(`La voz: ${error.message}`, true);
    case "provider_error":
      throw new OfficeFailure(`La voz: ${error.message}`, error.retryable);
  }
}

export const createVoiceOffice =
  (deps: VoiceDeps): Office =>
  async (ctx) => {
    const script = await readDocument(ctx, "script", scriptSchema);
    const voice = await ctx.voice();
    if (!voice) {
      throw new OfficeFailure("El video no tiene voz: elegí una en el catálogo de voces.", false);
    }
    const texts = script.scenes.map((s) => s.narration);
    const input: VoiceInput = {
      texts,
      voiceId: voice.externalId,
      model: DEFAULT_TTS_MODEL,
      speed: voice.speed,
    };

    // The same narration and voice as the last time: the audio is already paid for.
    const saved = voiceDocSchema.safeParse(await ctx.document("voice"));
    if (saved.success && canReuseVoice(saved.data.fingerprint, input)) {
      const first = saved.data.scenes[0];
      if (first && (await ctx.files.read(first.audio))) {
        ctx.log.info("voice reused: nothing changed since the last take");
        return { kind: "done", documents: [{ kind: "voice", data: saved.data, origin: "office" }] };
      }
    }

    if (!deps.tts) {
      throw new OfficeFailure("Falta ELEVENLABS_API_KEY en el .env de esta máquina.", false);
    }
    const made = await deps.tts.synthesize({
      texts,
      voiceId: input.voiceId,
      model: input.model,
      speed: input.speed,
    });
    if (!made.ok) return failedTts(made.error);

    const pcm = await deps.decode(made.audio);
    const scenes = splitScenes(pcm, made.words, texts);
    await ctx.files.write("voice/full.mp3", made.audio);
    const doc: VoiceDoc = {
      fingerprint: voiceFingerprint(input),
      voiceId: input.voiceId,
      model: made.model,
      speed: input.speed,
      characters: made.characters,
      fps: VIDEO_FPS,
      totalFrames: scenes.reduce((n, s) => n + s.frames, 0),
      full: "voice/full.mp3",
      scenes: [],
    };
    for (const scene of scenes) {
      const name = sceneName(scene.index);
      await ctx.files.write(`voice/${name}.wav`, wavFromPcm(scene.pcm, SAMPLE_RATE));
      await ctx.files.write(
        `voice/${name}.words.json`,
        new TextEncoder().encode(JSON.stringify(scene.words)),
      );
      doc.scenes.push({
        index: scene.index,
        frames: scene.frames,
        text: texts[scene.index] ?? "",
        audio: `voice/${name}.wav`,
        words: `voice/${name}.words.json`,
      });
    }
    ctx.log.info("voice made", {
      characters: made.characters,
      seconds: Math.round(doc.totalFrames / VIDEO_FPS),
    });
    // What is left this month, as of this take (the web has no key to ask).
    const quota = (await deps.tts.quota?.()) ?? null;
    return {
      kind: "done",
      documents: [{ kind: "voice", data: doc, origin: "office" }],
      usage: [
        {
          kind: "tts",
          quantity: made.characters,
          unit: "characters",
          durationMs: made.durationMs,
          ...(quota ? { data: { quota } } : {}),
        },
      ],
    };
  };
