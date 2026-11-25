import { describe, expect, it } from "vitest";
import { wavFromPcm } from "./wav";

describe("wavFromPcm", () => {
  const wav = wavFromPcm(new Int16Array([0, 1000, -1000, 32767]), 48_000);

  it("writes a valid PCM mono 16-bit header", () => {
    expect(wav.toString("ascii", 0, 4)).toBe("RIFF");
    expect(wav.toString("ascii", 8, 16)).toBe("WAVEfmt ");
    expect(wav.readUInt16LE(20)).toBe(1); // PCM
    expect(wav.readUInt16LE(22)).toBe(1); // mono
    expect(wav.readUInt32LE(24)).toBe(48_000);
    expect(wav.readUInt32LE(28)).toBe(96_000);
    expect(wav.readUInt16LE(34)).toBe(16);
    expect(wav.toString("ascii", 36, 40)).toBe("data");
  });

  it("has consistent sizes and keeps the samples", () => {
    expect(wav.length).toBe(44 + 8);
    expect(wav.readUInt32LE(4)).toBe(wav.length - 8);
    expect(wav.readUInt32LE(40)).toBe(8);
    expect([...Array(4).keys()].map((i) => wav.readInt16LE(44 + i * 2))).toEqual([
      0, 1000, -1000, 32767,
    ]);
  });
});
