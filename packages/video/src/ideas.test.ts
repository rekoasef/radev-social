import { VIDEO_IDEA_COUNT, VIDEO_IDEA_TOPIC_MAX } from "@radev/core";
import { describe, expect, it } from "vitest";
import { videoIdeasSchema } from "./ideas";

const idea = {
  topic: "El submarino soviético que no disparó su torpedo nuclear en 1962",
  hook: "Un solo oficial se negó.",
};
const source = { title: "Archivo", url: "https://nsarchive.gwu.edu/x" };

describe("videoIdeasSchema", () => {
  it("accepts ideas without sources when there was no search", () => {
    expect(videoIdeasSchema("generate").safeParse({ ideas: [idea] }).success).toBe(true);
  });

  it("asks for sources when it searched the web", () => {
    const research = videoIdeasSchema("research");
    expect(research.safeParse({ ideas: [idea] }).success).toBe(false);
    expect(research.safeParse({ ideas: [{ ...idea, sources: [source] }] }).success).toBe(true);
  });

  it("refuses links that are not http", () => {
    const bad = { ...idea, sources: [{ title: "x", url: "javascript:alert(1)" }] };
    expect(videoIdeasSchema("research").safeParse({ ideas: [bad] }).success).toBe(false);
  });

  it("refuses an empty answer, too many ideas and a topic that does not fit", () => {
    const schema = videoIdeasSchema("generate");
    expect(schema.safeParse({ ideas: [] }).success).toBe(false);
    expect(
      schema.safeParse({ ideas: Array.from({ length: VIDEO_IDEA_COUNT + 1 }, () => idea) }).success,
    ).toBe(false);
    const long = { ...idea, topic: "a".repeat(VIDEO_IDEA_TOPIC_MAX + 1) };
    expect(schema.safeParse({ ideas: [long] }).success).toBe(false);
  });
});
