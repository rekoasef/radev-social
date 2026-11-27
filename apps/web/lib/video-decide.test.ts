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

  it("a return can ask for another form", async () => {
    const d = deps(true);
    const decision = { event: "rejectScript", note: "otra forma", form: "misterio" } as const;
    await decideAndQueue(d, "v1", 2, decision);
    expect(d.decide).toHaveBeenCalledWith("v1", 2, decision);
  });
});

describe("decideAndQueue: «tu aporte»", () => {
  it("a return carries the operator's opinion to the database", async () => {
    const d = deps(true);
    const decision = {
      event: "rejectScript",
      note: "Sumá mi aporte.",
      contribution: "para mí nadie miraba",
    } as const;
    await decideAndQueue(d, "v1", 2, decision);
    expect(d.decide).toHaveBeenCalledWith("v1", 2, decision);
    expect(d.queue).toHaveBeenCalledWith("v1", "scripting");
  });
});

describe("decideAndQueue: the video desk", () => {
  it("approving the video queues nothing", async () => {
    const d = deps(true);
    await decideAndQueue(d, "v1", 1, { event: "approveVideo" });
    expect(d.queue).not.toHaveBeenCalled();
  });

  it("going back to the script desk queues nothing (the operator changes it himself)", async () => {
    const d = deps(true);
    await decideAndQueue(d, "v1", 1, { event: "returnToScriptDesk" });
    expect(d.queue).not.toHaveBeenCalled();
  });

  it.each([
    ["rejectVideoToRender", "rendering"],
    ["rejectVideoToVoice", "voicing"],
    ["rejectVideoToScript", "scripting"],
  ] as const)("%s sends it to %s", async (event, stage) => {
    const d = deps(true);
    await decideAndQueue(d, "v1", 1, { event, note: "cambiar algo" });
    expect(d.queue).toHaveBeenCalledWith("v1", stage);
  });
});
