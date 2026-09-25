import { describe, expect, it } from "vitest";
import { AI_TASKS } from "../ai/tasks";
import { ideaRequestKey, JOBS, QUEUE_OPTIONS } from "../jobs";
import { IDEA_REQUEST_STATUSES, IDEA_REQUEST_TASKS, isIdeaRequestOpen } from "./requests";

describe("idea requests", () => {
  it("only queued and running requests are open", () => {
    const open = IDEA_REQUEST_STATUSES.filter(isIdeaRequestOpen);
    expect(open).toEqual(["queued", "running"]);
  });

  it("each request task is an AI task with its own job and queue settings", () => {
    for (const task of IDEA_REQUEST_TASKS) {
      expect(AI_TASKS).toContain(task);
      expect(Object.values(JOBS)).toContain(task);
      expect(QUEUE_OPTIONS[task]).toBeDefined();
    }
  });

  it("one job per request", () => {
    expect(ideaRequestKey("abc")).toBe("ideas:abc");
  });
});
