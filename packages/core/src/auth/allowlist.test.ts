import { describe, expect, it } from "vitest";
import { isEmailAllowed, isOperator, parseAllowedEmails } from "./allowlist";

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

describe("isOperator", () => {
  const allowed = parseAllowedEmails("renzo@example.com");

  it("accepts a verified, allowlisted email", () => {
    expect(isOperator({ email: "Renzo@example.com", emailVerified: true }, allowed)).toBe(true);
  });

  it("rejects an allowlisted email that the provider did not verify", () => {
    expect(isOperator({ email: "renzo@example.com", emailVerified: false }, allowed)).toBe(false);
    expect(isOperator({ email: "renzo@example.com" }, allowed)).toBe(false);
  });

  it("rejects a verified email outside the allowlist", () => {
    expect(isOperator({ email: "intruso@example.com", emailVerified: true }, allowed)).toBe(false);
  });
});
