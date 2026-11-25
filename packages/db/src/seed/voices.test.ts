import { VOICE_PROVIDERS, VOICE_USES } from "@radev/core";
import { describe, expect, it } from "vitest";
import { seedVoices } from "./voices";

describe("seed voices", () => {
  it("has exactly one default per use and language (the database enforces it)", () => {
    const defaults = seedVoices.filter((v) => v.isDefault).map((v) => `${v.use}/${v.language}`);
    expect(new Set(defaults).size).toBe(defaults.length);
    expect(defaults).toContain("narrative/es");
  });

  it("makes Alberto the default narrator (ADR 0027)", () => {
    const alberto = seedVoices.find((v) => v.isDefault && v.use === "narrative");
    expect(alberto).toMatchObject({
      name: "Alberto Rodríguez",
      externalId: "l1zE9xgNpUTaQCZzpNJa",
    });
  });

  it("uses valid providers and uses, and no voice id twice", () => {
    for (const v of seedVoices) {
      expect(VOICE_PROVIDERS).toContain(v.provider);
      expect(VOICE_USES).toContain(v.use);
    }
    const ids = seedVoices.map((v) => `${v.provider}/${v.externalId}`);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
