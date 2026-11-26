import { describe, expect, it } from "vitest";
import { classifyElevenLabsError, createElevenLabsProvider } from "./elevenlabs";

const text = "Hola mundo. ¿Cómo estás?";
const alignment = (t: string) => ({
  characters: [...t],
  character_start_times_seconds: [...t].map((_, i) => i * 0.05),
  character_end_times_seconds: [...t].map((_, i) => (i + 1) * 0.05),
});
const ok = (t = text) =>
  new Response(
    JSON.stringify({
      audio_base64: Buffer.from("MP3").toString("base64"),
      alignment: alignment(t),
    }),
    { status: 200 },
  );

type Call = { url: string; method: string; headers: Record<string, string>; body: unknown };
function fakeFetch(...responses: Response[]) {
  const calls: Call[] = [];
  const impl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({
      url: String(url),
      method: init?.method ?? "GET",
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    const next = responses[calls.length - 1];
    if (!next) throw new Error("fetch llamado de más");
    return next;
  }) as typeof fetch;
  return { impl, calls };
}
const make = (...responses: Response[]) => {
  const f = fakeFetch(...responses);
  const provider = createElevenLabsProvider({ apiKey: "k", fetch: f.impl });
  if (!provider) throw new Error("sin proveedor");
  return { provider, calls: f.calls };
};

describe("createElevenLabsProvider", () => {
  it("has no provider without a key", () => {
    expect(createElevenLabsProvider({ env: {} })).toBeNull();
  });

  it("sends the whole narration in ONE request, with the key in a header", async () => {
    const { provider, calls } = make(ok());
    const r = await provider.synthesize({ texts: ["Hola mundo.", "¿Cómo estás?"], voiceId: "v1" });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      url: "https://api.elevenlabs.io/v1/text-to-speech/v1/with-timestamps",
      method: "POST",
      headers: { "xi-api-key": "k" },
      body: { text, model_id: "eleven_v3", voice_settings: { stability: 0.5 } },
    });
    expect(r).toMatchObject({ ok: true, characters: text.length, mime: "audio/mpeg" });
    if (r.ok) {
      expect(r.audio.toString()).toBe("MP3");
      expect(r.words.map((w) => w.word)).toEqual(["Hola", "mundo.", "¿Cómo", "estás?"]);
    }
  });

  it("with multilingual_v2, sends no settings: the voice's saved ones apply", async () => {
    const { provider, calls } = make(ok());
    await provider.synthesize({
      texts: ["Hola mundo.", "¿Cómo estás?"],
      voiceId: "v1",
      model: "eleven_multilingual_v2",
    });
    expect(calls[0]?.body).not.toHaveProperty("voice_settings");
  });

  it("with v3 and a speed, keeps the saved settings but the stability v3 accepts", async () => {
    const stored = { stability: 0.3, similarity_boost: 0.85, style: 0.3 };
    const { provider, calls } = make(new Response(JSON.stringify(stored)), ok());
    await provider.synthesize({ texts: [text], voiceId: "v1", speed: 1.1 });
    expect(calls[1]?.body).toMatchObject({
      model_id: "eleven_v3",
      voice_settings: { stability: 0.5, similarity_boost: 0.85, speed: 1.1 },
    });
  });

  it("with a speed, reads the saved settings first and sends them along (ADR 0027)", async () => {
    const stored = { stability: 0.5, similarity_boost: 0.8, speed: 0.92 };
    const { provider, calls } = make(new Response(JSON.stringify(stored)), ok());
    await provider.synthesize({ texts: [text], voiceId: "v1", speed: 1.1 });
    expect(calls.map((c) => c.method)).toEqual(["GET", "POST"]);
    expect(calls[0]?.url).toBe("https://api.elevenlabs.io/v1/voices/v1/settings");
    expect(calls[1]?.body).toMatchObject({ voice_settings: { ...stored, speed: 1.1 } });
  });

  it("refuses a speed ElevenLabs does not accept, without calling it", async () => {
    const { provider, calls } = make();
    const r = await provider.synthesize({ texts: [text], voiceId: "v1", speed: 1.5 });
    expect(r).toMatchObject({ ok: false, error: { kind: "provider_error", retryable: false } });
    expect(calls).toHaveLength(0);
  });

  it("refuses an empty narration", async () => {
    const { provider, calls } = make();
    expect(await provider.synthesize({ texts: ["  ", ""], voiceId: "v1" })).toMatchObject({
      ok: false,
    });
    expect(calls).toHaveLength(0);
  });

  it("fails when the times do not match the words of the text", async () => {
    const { provider } = make(ok("Hola mundo."));
    const r = await provider.synthesize({ texts: [text], voiceId: "v1" });
    expect(r).toMatchObject({ ok: false, error: { kind: "alignment" } });
  });

  it("fails on a response without audio or without times", async () => {
    const { provider } = make(new Response(JSON.stringify({ audio_base64: "AA==" })));
    expect(await provider.synthesize({ texts: [text], voiceId: "v1" })).toMatchObject({
      ok: false,
      error: { kind: "provider_error", retryable: true },
    });
  });

  it("maps a network failure to a retryable error", async () => {
    const provider = createElevenLabsProvider({
      apiKey: "k",
      fetch: (async () => {
        throw new Error("ECONNRESET");
      }) as typeof fetch,
    });
    expect(await provider?.synthesize({ texts: [text], voiceId: "v1" })).toMatchObject({
      ok: false,
      error: { kind: "provider_error", retryable: true },
    });
  });

  it("never puts the key in an error", async () => {
    const { provider } = make(new Response('{"detail":"bad key"}', { status: 401 }));
    const r = await provider.synthesize({ texts: [text], voiceId: "v1" });
    expect(JSON.stringify(r)).not.toContain('"k"');
  });
});

describe("classifyElevenLabsError", () => {
  it("out of credits (quota_exceeded) is its own error, to warn the operator", () => {
    const body = JSON.stringify({
      detail: { status: "quota_exceeded", message: "0 credits left" },
    });
    expect(classifyElevenLabsError(401, body)).toMatchObject({ kind: "no_credits" });
  });

  it.each([
    [429, "rate_limited"],
    [401, "provider_error"],
    [403, "provider_error"],
    [402, "provider_error"],
    [422, "provider_error"],
    [500, "provider_error"],
  ])("%i → %s", (status, kind) => {
    expect(classifyElevenLabsError(status, "{}")).toMatchObject({ kind });
  });

  it("retries a 5xx but not a 4xx", () => {
    expect(classifyElevenLabsError(503, "x")).toMatchObject({ retryable: true });
    expect(classifyElevenLabsError(422, "x")).toMatchObject({ retryable: false });
  });

  it("reads the detail as a plain string too", () => {
    expect(classifyElevenLabsError(422, '{"detail":"voz inexistente"}')).toMatchObject({
      message: expect.stringContaining("voz inexistente"),
    });
  });
});

describe("quota and sample (information only, they never fail)", () => {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

  it("reads the month's credits", async () => {
    const { provider, calls } = make(
      json({
        character_count: 3834,
        character_limit: 38439,
        next_character_count_reset_unix: 1796000000,
      }),
    );
    expect(await provider.quota?.()).toEqual({
      used: 3834,
      limit: 38439,
      resetsAt: new Date(1796000000 * 1000).toISOString(),
    });
    expect(calls[0]?.url).toBe("https://api.elevenlabs.io/v1/user/subscription");
  });

  it("is null when the key cannot read it", async () => {
    const { provider } = make(json({ detail: "missing_permissions" }, 401));
    expect(await provider.quota?.()).toBeNull();
  });

  it("gives the voice's sample, only an https link", async () => {
    const { provider } = make(json({ preview_url: "https://cdn.example/v.mp3" }), json({}));
    expect(await provider.previewUrl?.("v1")).toBe("https://cdn.example/v.mp3");
    expect(await provider.previewUrl?.("v1")).toBeNull();
  });
});
