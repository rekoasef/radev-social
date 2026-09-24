import { describe, expect, it } from "vitest";
import { publicCode } from "./constants";

describe("publicCode", () => {
  it("pads the number to four digits", () => {
    expect(publicCode("RA", 1)).toBe("RA-0001");
    expect(publicCode("LU", 142)).toBe("LU-0142");
  });

  it("keeps growing past 9999", () => {
    expect(publicCode("RA", 12345)).toBe("RA-12345");
  });
});
