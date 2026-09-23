import { afterEach, describe, expect, it, vi } from "vitest";
import { createLogger } from "./logger";

function capture() {
  const out = vi.spyOn(process.stdout, "write").mockReturnValue(true);
  const err = vi.spyOn(process.stderr, "write").mockReturnValue(true);
  const lines = () =>
    [...out.mock.calls, ...err.mock.calls].map(([chunk]) => JSON.parse(String(chunk)));
  return { out, err, lines };
}

afterEach(() => vi.restoreAllMocks());

describe("createLogger", () => {
  it("writes one JSON line with level, message and base fields", () => {
    const { lines } = capture();
    createLogger({ service: "worker" }, "info").info("ready", { jobs: 0 });
    expect(lines()).toEqual([
      expect.objectContaining({ level: "info", message: "ready", service: "worker", jobs: 0 }),
    ]);
  });

  it("drops entries below the minimum level", () => {
    const { lines } = capture();
    createLogger({}, "warn").info("noise");
    expect(lines()).toEqual([]);
  });

  it("sends errors to stderr with the error serialized", () => {
    const { err, lines } = capture();
    createLogger({}, "info").error("boom", { error: new Error("db down") });
    expect(err).toHaveBeenCalledOnce();
    expect(lines()[0].error).toMatchObject({ name: "Error", message: "db down" });
  });

  it("child loggers keep the parent fields", () => {
    const { lines } = capture();
    createLogger({ service: "worker" }, "info").child({ job: "carousel.render" }).info("start");
    expect(lines()[0]).toMatchObject({ service: "worker", job: "carousel.render" });
  });
});
