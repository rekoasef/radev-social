import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptToken, encryptToken, tokenEncryptionKey } from "./token-crypto";

const keyText = randomBytes(32).toString("base64");
const key = tokenEncryptionKey(keyText);

describe("tokenEncryptionKey", () => {
  it("accepts 32 bytes in base64", () => {
    expect(key).toHaveLength(32);
  });

  it.each([
    undefined,
    "",
    randomBytes(16).toString("base64"),
    randomBytes(33).toString("base64"),
    "no es base64 ni de casualidad!!",
  ])("rejects %j", (value) => {
    expect(() => tokenEncryptionKey(value)).toThrow(/TOKEN_ENCRYPTION_KEY/);
  });

  it("does not echo the value in the error", () => {
    const bad = randomBytes(20).toString("base64");
    expect(() => tokenEncryptionKey(bad)).toThrow(expect.not.stringContaining(bad));
  });
});

describe("encryptToken / decryptToken", () => {
  it("round-trips, including non-ASCII text", () => {
    for (const plain of ["act.abc123", "", "ñandú ✓ 🔑", "x".repeat(5000)]) {
      const stored = encryptToken(plain, "tiktok:access", key);
      expect(decryptToken(stored, "tiktok:access", key)).toBe(plain);
    }
  });

  it("never stores the token in clear and uses a fresh IV each time", () => {
    const a = encryptToken("act.secret-token", "ctx", key);
    const b = encryptToken("act.secret-token", "ctx", key);
    expect(a).toMatch(/^v1\.[A-Za-z0-9_-]+$/);
    expect(a).not.toContain("secret");
    expect(a).not.toBe(b);
  });

  it("fails with another key", () => {
    const stored = encryptToken("act.1", "ctx", key);
    expect(() => decryptToken(stored, "ctx", randomBytes(32))).toThrow(/descifrar/);
  });

  it("fails with another context (an access token is not a refresh token)", () => {
    const stored = encryptToken("act.1", "tiktok:access", key);
    expect(() => decryptToken(stored, "tiktok:refresh", key)).toThrow(/descifrar/);
  });

  it("fails if a single byte changed", () => {
    const stored = encryptToken("act.1", "ctx", key);
    const payload = Buffer.from(stored.slice(3), "base64url");
    payload[payload.length - 1] = (payload[payload.length - 1] ?? 0) ^ 1;
    expect(() => decryptToken(`v1.${payload.toString("base64url")}`, "ctx", key)).toThrow(
      /descifrar/,
    );
  });

  it.each(["", "act.plain", "v2.AAAA", "v1.", "v1.AAAA", "v1.a.b"])("rejects %j", (stored) => {
    expect(() => decryptToken(stored, "ctx", key)).toThrow();
  });
});
