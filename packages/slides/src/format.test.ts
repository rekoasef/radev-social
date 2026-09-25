import { describe, expect, it } from "vitest";
import { decimalsFor, formatNumber, withUnit } from "./format";

describe("formatNumber", () => {
  it("groups thousands with dots and uses a decimal comma", () => {
    expect(formatNumber(1234567)).toBe("1.234.567");
    expect(formatNumber(1234.5, 2)).toBe("1.234,50");
    expect(formatNumber(999)).toBe("999");
    expect(formatNumber(0.5, 1)).toBe("0,5");
  });

  it("handles negatives, without a sign on a rounded zero", () => {
    expect(formatNumber(-1500)).toBe("-1.500");
    expect(formatNumber(-0.001, 1)).toBe("0,0");
  });
});

describe("decimalsFor", () => {
  it("shows fewer decimals for bigger values", () => {
    expect(decimalsFor([1200, 1300])).toBe(0);
    expect(decimalsFor([12.5, 40])).toBe(1);
    expect(decimalsFor([0.25, 3])).toBe(2);
  });

  it("shows no decimals when every value is whole", () => {
    expect(decimalsFor([12, 18, 9])).toBe(0);
  });

  it("never shows more decimals than the values have", () => {
    expect(decimalsFor([1.4, 0.4, 1.8])).toBe(1);
    expect(decimalsFor([1.4, 0.25])).toBe(2);
    expect(decimalsFor([0.123456, 3])).toBe(2);
  });
});

describe("withUnit", () => {
  it("places the unit before or after", () => {
    expect(withUnit("1.200", "$", "before")).toBe("$ 1.200");
    expect(withUnit("12", "%", "after")).toBe("12 %");
    expect(withUnit("12", undefined, "after")).toBe("12");
  });
});
