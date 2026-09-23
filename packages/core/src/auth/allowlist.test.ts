import { describe, expect, it } from "vitest";
import { isEmailAllowed, parseAllowedEmails } from "./allowlist";

describe("parseAllowedEmails", () => {
  it("returns an empty set when the value is missing or blank", () => {
    expect(parseAllowedEmails(undefined).size).toBe(0);
    expect(parseAllowedEmails("").size).toBe(0);
    expect(parseAllowedEmails("  , ,").size).toBe(0);
  });

  it("splits by commas and whitespace, trims and lowercases", () => {
    const allowed = parseAllowedEmails(
      " Renzo@Example.com, otro@example.com\nTercero@example.com ",
    );
    expect([...allowed]).toEqual(["renzo@example.com", "otro@example.com", "tercero@example.com"]);
  });
});

describe("isEmailAllowed", () => {
  const allowed = parseAllowedEmails("renzo@example.com");

  it("accepts a listed email regardless of case and surrounding spaces", () => {
    expect(isEmailAllowed("renzo@example.com", allowed)).toBe(true);
    expect(isEmailAllowed("  RENZO@example.com ", allowed)).toBe(true);
  });

  it("rejects unlisted, empty or missing emails", () => {
    expect(isEmailAllowed("intruso@example.com", allowed)).toBe(false);
    expect(isEmailAllowed("", allowed)).toBe(false);
    expect(isEmailAllowed(null, allowed)).toBe(false);
    expect(isEmailAllowed(undefined, allowed)).toBe(false);
  });

  it("rejects everyone when the allowlist is empty", () => {
    expect(isEmailAllowed("renzo@example.com", parseAllowedEmails(""))).toBe(false);
  });
});
