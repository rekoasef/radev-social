import { describe, expect, it } from "vitest";
import { parseRange } from "./http-range";

describe("parseRange", () => {
  it.each([
    ["bytes=0-", { start: 0, end: 999 }],
    ["bytes=500-", { start: 500, end: 999 }],
    ["bytes=0-1", { start: 0, end: 1 }],
    ["bytes=900-5000", { start: 900, end: 999 }],
    ["bytes=-100", { start: 900, end: 999 }],
    ["bytes=-5000", { start: 0, end: 999 }],
  ])("reads %s", (header, range) => {
    expect(parseRange(header, 1000)).toEqual(range);
  });

  it.each([null, "", "bytes=-", "bytes=abc", "items=0-1", "bytes=0-1,5-6", "bytes=9-3"])(
    "answers with the whole file for %j",
    (header) => {
      expect(parseRange(header, 1000)).toBe("full");
    },
  );

  it.each([
    ["bytes=1000-", 1000],
    ["bytes=-0", 1000],
    ["bytes=0-", 0],
  ])("cannot satisfy %s of %i bytes", (header, size) => {
    expect(parseRange(header, size)).toBe("unsatisfiable");
  });
});
