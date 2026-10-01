import { describe, expect, it } from "vitest";
import { isLeadStatus, normalizePostRef, postRef } from "./leads";

describe("postRef", () => {
  it("uses our code, or TK- and the end of TikTok's id", () => {
    expect(postRef({ code: "RA-0142", externalId: "7691331151528545557" })).toBe("RA-0142");
    expect(postRef({ code: null, externalId: "7691331151528545557" })).toBe("TK-545557");
  });
});

describe("normalizePostRef", () => {
  it("cleans what the operator types", () => {
    expect(normalizePostRef(" ra-0142 ")).toBe("RA-0142");
    expect(normalizePostRef("tk- 545557")).toBe("TK-545557");
    expect(normalizePostRef("  ")).toBeNull();
  });
});

describe("small rules", () => {
  it("lead statuses", () => {
    expect(isLeadStatus("client")).toBe(true);
    expect(isLeadStatus("won")).toBe(false);
  });
});
