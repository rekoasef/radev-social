import { describe, expect, it } from "vitest";
import {
  CLOUDFLARE_IMAGE_MODEL,
  classifyCloudflareError,
  createCloudflareImageProvider,
} from "./cloudflare";
import { artPrompt, colorName } from "./prompt";

const env = { CLOUDFLARE_ACCOUNT_ID: "acc-1", CLOUDFLARE_API_TOKEN: "cf-secret-token" };

/** A fetch that answers once and records the request. */
function fakeFetch(status: number, body: unknown) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe("createCloudflareImageProvider", () => {
  it("is null without credentials: the posts go without images", () => {
    expect(createCloudflareImageProvider({ env: {} })).toBeNull();
    expect(createCloudflareImageProvider({ env: { CLOUDFLARE_ACCOUNT_ID: "a" } })).toBeNull();
  });

  it("asks FLUX.1 schnell with the token in the header and returns the image", async () => {
    const png = Buffer.from("fake-jpeg");
    const { impl, calls } = fakeFetch(200, {
      success: true,
      result: { image: png.toString("base64") },
    });
    const provider = createCloudflareImageProvider({ env, fetch: impl });
    const result = await provider?.generate({ prompt: "a padlock" });
    expect(result).toMatchObject({ ok: true, mime: "image/jpeg", model: CLOUDFLARE_IMAGE_MODEL });
    if (result?.ok) expect(result.image.equals(png)).toBe(true);
    const [call] = calls;
    expect(call?.url).toBe(
      `https://api.cloudflare.com/client/v4/accounts/acc-1/ai/run/${CLOUDFLARE_IMAGE_MODEL}`,
    );
    expect((call?.init.headers as Record<string, string> | undefined)?.Authorization).toBe(
      "Bearer cf-secret-token",
    );
    // Only what FLUX.1 schnell takes: it rejects any other property (a seed, for instance).
    expect(JSON.parse(String(call?.init.body))).toEqual({ prompt: "a padlock", steps: 8 });
  });

  it("maps failures without leaking the token", async () => {
    const cases: [number, unknown, string][] = [
      [429, { success: false, errors: [{ message: "Too many requests" }] }, "rate_limited"],
      [401, { success: false, errors: [{ message: "Authentication error" }] }, "provider_error"],
      [500, { success: false, errors: [] }, "provider_error"],
      [200, { success: true, result: {} }, "provider_error"],
    ];
    for (const [status, body, kind] of cases) {
      const provider = createCloudflareImageProvider({ env, fetch: fakeFetch(status, body).impl });
      const result = await provider?.generate({ prompt: "x" });
      expect(result?.ok).toBe(false);
      if (result && !result.ok) {
        expect(result.error.kind, String(status)).toBe(kind);
        expect(result.error.message).not.toContain("cf-secret-token");
      }
    }
  });

  it("reports a network failure as retryable", async () => {
    const failing = (async () => {
      throw new Error("ECONNRESET");
    }) as unknown as typeof fetch;
    const result = await createCloudflareImageProvider({ env, fetch: failing })?.generate({
      prompt: "x",
    });
    expect(result).toMatchObject({ ok: false, error: { kind: "provider_error", retryable: true } });
  });
});

describe("classifyCloudflareError", () => {
  it("treats the used-up daily allocation as a limit", () => {
    expect(
      classifyCloudflareError(400, "You have used up your daily free allocation of 10,000 neurons")
        .kind,
    ).toBe("rate_limited");
  });
});

describe("artPrompt", () => {
  it("always adds the rules, the look's background and the brand's accent", () => {
    const prompt = artPrompt("  A cracked black ceramic sphere  ", {
      background: "dark",
      accent: "#FF7A00",
    });
    expect(prompt.startsWith("A cracked black ceramic sphere")).toBe(true);
    expect(prompt).toContain("no people");
    expect(prompt).toContain("No text");
    expect(prompt).toContain("pure black background");
    expect(prompt).toContain("in orange");
    expect(artPrompt("x", { background: "light", accent: "#FF7A00" })).toContain(
      "pure white background",
    );
    expect(artPrompt("x", { background: "dark", accent: "#FF7A00", monochrome: true })).toContain(
      "Black and white only",
    );
  });

  it("names the accent roughly", () => {
    expect(colorName("#FF7A00")).toBe("orange");
    expect(colorName("#BDB4FF")).toBe("pale blue");
    expect(colorName("#7C3AED")).toBe("violet");
    expect(colorName("#0B0B0B")).toBe("black");
    expect(colorName("nope")).toBe("warm");
  });
});
