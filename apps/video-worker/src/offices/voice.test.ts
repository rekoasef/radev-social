import { SAMPLE_RATE, type TtsProvider, type TtsResult, type TtsWord } from "@radev/ai";
import { voiceFingerprint } from "@radev/core";
import { describe, expect, it, vi } from "vitest";
import scriptFixture from "../../../../packages/video/test/fixtures/mona-script.json";
import { makeCtx, video } from "./harness";
import { createVoiceOffice } from "./voice";

const script = () => structuredClone(scriptFixture);
const texts = () => script().scenes.map((s) => s.narration);

/** A take where every word lasts 0.3 s with 0.1 s between words and 0.5 s between scenes. */
function fakeTake(): { words: TtsWord[]; seconds: number } {
  const words: TtsWord[] = [];
  let t = 0;
  for (const text of texts()) {
    for (const w of text.split(/\s+/).filter(Boolean)) {
      words.push({ word: w, start: t, end: t + 0.3 });
      t += 0.4;
    }
    t += 0.4;
  }
  return { words, seconds: t };
}

const provider = (result: TtsResult): TtsProvider & { synthesize: ReturnType<typeof vi.fn> } => ({
  id: "elevenlabs",
  synthesize: vi.fn(async () => result),
});
const take = fakeTake();
const ok: TtsResult = {
  ok: true,
  audio: Buffer.from("MP3"),
  mime: "audio/mpeg",
  words: take.words,
  characters: texts().join(" ").length,
  model: "eleven_multilingual_v2",
  durationMs: 1234,
};
const decode = async () => new Int16Array(Math.round(take.seconds * SAMPLE_RATE));
const docs = { script: script() };

describe("voice office", () => {
  it("makes the voice in one request, cuts it by scene and writes the audio and the times", async () => {
    const tts = provider(ok);
    const { ctx, files } = makeCtx({ docs });
    const r = await createVoiceOffice({ tts, decode })(ctx);
    expect(tts.synthesize).toHaveBeenCalledTimes(1);
    expect(tts.synthesize.mock.calls[0]?.[0]).toMatchObject({ voiceId: "voz-1", texts: texts() });
    if (r.kind !== "done") throw new Error("debía terminar");
    const doc = r.documents[0]?.data as {
      scenes: { frames: number; audio: string }[];
      totalFrames: number;
    };
    expect(doc.scenes).toHaveLength(texts().length);
    expect(doc.totalFrames).toBe(doc.scenes.reduce((n, s) => n + s.frames, 0));
    expect(
      files.has("voice/s00.wav") &&
        files.has("voice/s00.words.json") &&
        files.has("voice/full.mp3"),
    ).toBe(true);
    expect(r.usage).toEqual([
      { kind: "tts", quantity: ok.ok ? ok.characters : 0, unit: "characters", durationMs: 1234 },
    ]);
  });

  it("makes another take when the video was sent back to the voice", async () => {
    const a = makeCtx({ docs });
    const r1 = await createVoiceOffice({ tts: provider(ok), decode })(a.ctx);
    if (r1.kind !== "done") throw new Error("debía terminar");

    const second = provider(ok);
    const b = makeCtx({
      video: video({ stage: "voicing", rejectionNote: "pronuncia mal Peruggia" }),
      docs: { ...docs, voice: r1.documents[0]?.data },
      files: Object.fromEntries(a.files),
    });
    await createVoiceOffice({ tts: second, decode })(b.ctx);
    expect(second.synthesize).toHaveBeenCalledOnce();
  });

  it("does not pay for the voice again when nothing changed", async () => {
    const first = provider(ok);
    const a = makeCtx({ docs });
    const r1 = await createVoiceOffice({ tts: first, decode })(a.ctx);
    if (r1.kind !== "done") throw new Error("debía terminar");
    const saved = r1.documents[0]?.data;

    const second = provider(ok);
    const b = makeCtx({ docs: { ...docs, voice: saved }, files: Object.fromEntries(a.files) });
    const r2 = await createVoiceOffice({ tts: second, decode })(b.ctx);
    expect(second.synthesize).not.toHaveBeenCalled();
    expect(r2).toMatchObject({ kind: "done", documents: [{ kind: "voice" }] });
    expect(r2.kind === "done" && r2.usage).toBeFalsy();
  });

  it("makes it again when a narration changed", async () => {
    const a = makeCtx({ docs });
    const r1 = await createVoiceOffice({ tts: provider(ok), decode })(a.ctx);
    if (r1.kind !== "done") throw new Error("debía terminar");
    const edited = script();
    edited.scenes[2]!.narration += " Y un dato más.";
    const tts = provider(ok);
    const b = makeCtx({
      docs: { script: edited, voice: r1.documents[0]?.data },
      files: Object.fromEntries(a.files),
    });
    // the fake take no longer matches the edited text, so it fails on the times: it did ask again
    await createVoiceOffice({ tts, decode })(b.ctx).catch(() => {});
    expect(tts.synthesize).toHaveBeenCalledTimes(1);
  });

  it("makes it again when the audio files are gone, even with the same text", async () => {
    const a = makeCtx({ docs });
    const r1 = await createVoiceOffice({ tts: provider(ok), decode })(a.ctx);
    if (r1.kind !== "done") throw new Error("debía terminar");
    const tts = provider(ok);
    const b = makeCtx({ docs: { ...docs, voice: r1.documents[0]?.data } });
    await createVoiceOffice({ tts, decode })(b.ctx);
    expect(tts.synthesize).toHaveBeenCalledTimes(1);
  });

  it("fingerprints what changes the audio", () => {
    const base = { texts: texts(), voiceId: "voz-1", model: "eleven_multilingual_v2", speed: null };
    expect(voiceFingerprint(base)).not.toBe(voiceFingerprint({ ...base, speed: 1.1 }));
  });

  it("pauses the video when the account is out of credits", async () => {
    const tts = provider({ ok: false, error: { kind: "no_credits", message: "sin créditos" } });
    const r = await createVoiceOffice({ tts, decode })(makeCtx({ docs }).ctx);
    expect(r).toMatchObject({ kind: "pause", reason: "budget" });
  });

  it("returns the provider's limit", async () => {
    const tts = provider({
      ok: false,
      error: { kind: "rate_limited", message: "l", retryAfterMs: 5000 },
    });
    expect(await createVoiceOffice({ tts, decode })(makeCtx({ docs }).ctx)).toEqual({
      kind: "rate_limited",
      retryAfterMs: 5000,
    });
  });

  it("fails without a voice or without the key, and retrying would not help", async () => {
    await expect(
      createVoiceOffice({ tts: provider(ok), decode })(makeCtx({ docs, voice: null }).ctx),
    ).rejects.toMatchObject({ retryable: false });
    await expect(
      createVoiceOffice({ tts: null, decode })(makeCtx({ docs }).ctx),
    ).rejects.toMatchObject({
      retryable: false,
      message: expect.stringContaining("ELEVENLABS_API_KEY"),
    });
  });

  it("a text the times do not match is retryable", async () => {
    const tts = provider({ ok: false, error: { kind: "alignment", message: "no calzan" } });
    await expect(createVoiceOffice({ tts, decode })(makeCtx({ docs }).ctx)).rejects.toMatchObject({
      retryable: true,
    });
  });
});
