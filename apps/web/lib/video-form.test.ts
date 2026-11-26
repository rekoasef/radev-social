import { describe, expect, it } from "vitest";
import { newVideoSchema } from "./video-form";

const voiceId = "3f1c2b9a-1111-4222-8333-444455556666";
const valid = { topic: "El apagón de Nueva York de 1977", brandId: "", voiceId };

describe("newVideoSchema", () => {
  it("accepts a topic without a brand and trims it", () => {
    const r = newVideoSchema.parse({ ...valid, topic: `  ${valid.topic}  ` });
    expect(r).toEqual(valid);
  });

  it("rejects a topic that is too short and a missing voice", () => {
    expect(newVideoSchema.safeParse({ ...valid, topic: "apagón" }).success).toBe(false);
    expect(newVideoSchema.safeParse({ ...valid, voiceId: "" }).success).toBe(false);
  });
});
