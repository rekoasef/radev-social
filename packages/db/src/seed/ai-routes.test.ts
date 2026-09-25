import { AI_TASKS, checkAiRoute } from "@radev/core";
import { describe, expect, it } from "vitest";
import { seedAiRoutes } from "./ai-routes";

describe("seed AI routes", () => {
  it("has one global route per task", () => {
    expect(seedAiRoutes.map((route) => route.task).sort()).toEqual([...AI_TASKS].sort());
  });

  it.each(seedAiRoutes.map((route) => [route.task, route] as const))(
    "%s follows the routing rules",
    (_, route) => {
      expect(checkAiRoute(route)).toEqual([]);
    },
  );
});
