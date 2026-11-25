// The voice is paid for (ElevenLabs credits, ADR 0027): it is only made again when the narration or
// the voice settings change. The worker compares fingerprints before calling the provider.

export type VoiceInput = {
  /** The narration of each scene, in order. */
  texts: readonly string[];
  voiceId: string;
  model: string;
  /** The voice's speed (null: the one saved in the voice). */
  speed: number | null;
};

/** A canonical string of everything that changes the audio. Whitespace does not count. */
export function voiceFingerprint(input: VoiceInput): string {
  return JSON.stringify({
    texts: input.texts.map((t) => t.replace(/\s+/g, " ").trim()),
    voiceId: input.voiceId,
    model: input.model,
    speed: input.speed,
  });
}

/** Whether the audio already made is still good for the new input. */
export function canReuseVoice(previous: string | null | undefined, next: VoiceInput): boolean {
  return previous === voiceFingerprint(next);
}
