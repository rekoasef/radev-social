import { describe, expect, it } from "vitest";
import {
  normalizeWhatsappMessage,
  normalizeWhatsappNumber,
  WHATSAPP_MESSAGE_MAX,
  whatsappLink,
  whatsappMessage,
} from "./contact";

describe("normalizeWhatsappNumber", () => {
  it.each([
    ["+54 9 351 555-1234", "5493515551234"],
    ["5493515551234", "5493515551234"],
    ["+34 (612) 34.56.78", "34612345678"],
    ["  +1 415 555 0100 ", "14155550100"],
  ])("%j → %j", (input, digits) => {
    expect(normalizeWhatsappNumber(input)).toEqual({ ok: true, value: digits });
  });

  it("empty means no WhatsApp", () => {
    expect(normalizeWhatsappNumber("   ")).toEqual({ ok: true, value: null });
  });

  it.each([
    ["letters", "+54 9 351 CALL"],
    ["too short (no country code)", "351 5551"],
    ["too long", "+54 9 351 555 1234 5678"],
    ["starts with 0", "0351 555 1234"],
    ["a second +", "+54 +9 351 555 1234"],
  ])("rejects %s", (_, input) => {
    expect(normalizeWhatsappNumber(input).ok).toBe(false);
  });
});

describe("normalizeWhatsappMessage", () => {
  it("keeps a message with {code}, trimmed", () => {
    expect(normalizeWhatsappMessage("  Hola! Vi el post {code}  ")).toEqual({
      ok: true,
      value: "Hola! Vi el post {code}",
    });
  });

  it("empty means no prefilled message", () => {
    expect(normalizeWhatsappMessage("")).toEqual({ ok: true, value: null });
  });

  it("needs {code}, so every lead points to a post", () => {
    expect(normalizeWhatsappMessage("Hola! Quiero consultar").ok).toBe(false);
  });

  it("rejects unknown variables", () => {
    const check = normalizeWhatsappMessage("Hola {name}, vi el post {code}");
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.reason).toContain("{name}");
  });

  it("rejects a message over the limit", () => {
    expect(normalizeWhatsappMessage(`{code} ${"a".repeat(WHATSAPP_MESSAGE_MAX)}`).ok).toBe(false);
  });
});

describe("message and link", () => {
  it("puts the post's code in every {code}", () => {
    expect(whatsappMessage("Vi {code}. Código: {code}", "RA-0142")).toBe(
      "Vi RA-0142. Código: RA-0142",
    );
  });

  it("links to wa.me with the message encoded", () => {
    expect(whatsappLink("5493515551234", "Hola! Vi RA-0142 & quiero info")).toBe(
      "https://wa.me/5493515551234?text=Hola!%20Vi%20RA-0142%20%26%20quiero%20info",
    );
    expect(whatsappLink("5493515551234")).toBe("https://wa.me/5493515551234");
  });
});
