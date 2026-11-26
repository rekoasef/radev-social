import { describe, expect, it, vi } from "vitest";
import { decideAndQueue } from "./video-decide";

const deps = (ok: boolean) => ({
  decide: vi.fn(async () => (ok ? { ok: true as const } : { ok: false as const, reason: "viejo" })),
  queue: vi.fn(async () => {}),
});

describe("decideAndQueue", () => {
  it("queues the voice only after the script was approved", async () => {
    const d = deps(true);
    await decideAndQueue(d, "v1", 2, { event: "approveScript" });
    expect(d.queue).toHaveBeenCalledWith("v1", "voicing");
  });

  it("queues nothing when the approval is refused: no voice, nothing paid", async () => {
    const d = deps(false);
    expect(await decideAndQueue(d, "v1", 1, { event: "approveScript" })).toEqual({
      ok: false,
      reason: "viejo",
    });
    expect(d.queue).not.toHaveBeenCalled();
  });

  it("a returned script goes back to the Script office", async () => {
    const d = deps(true);
    await decideAndQueue(d, "v1", 2, { event: "rejectScript", note: "cambiar el final" });
    expect(d.queue).toHaveBeenCalledWith("v1", "scripting");
  });
});
