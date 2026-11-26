import type { TtsProvider } from "@radev/ai";
import { type Database, listVoices, setVoicePreview } from "@radev/db";
import type { Logger } from "./logger";

// The sample of each voice, so the panel can play it before choosing (it costs no credits). The web
// has no ElevenLabs key: the worker saves the link when it starts. Best effort: without a sample the
// voice works the same.

export async function fillVoicePreviews(
  db: Database,
  tts: TtsProvider | null,
  log: Logger,
): Promise<void> {
  if (!tts?.previewUrl) return;
  const missing = (await listVoices(db)).filter(
    (v) => v.provider === "elevenlabs" && !v.previewUrl,
  );
  for (const voice of missing) {
    const url = await tts.previewUrl(voice.externalId);
    if (url) await setVoicePreview(db, voice.id, url);
    else log.warn("no sample for the voice", { voice: voice.name });
  }
}
