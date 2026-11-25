import { describe, expect, it } from "vitest";
import { createAiLock } from "./ai-lock";

const tick = () => new Promise((r) => setTimeout(r, 0));

describe("AI lock", () => {
  it("never runs two at once, and keeps the order they came in", async () => {
    const lock = createAiLock();
    let running = 0;
    let max = 0;
    const order: number[] = [];
    const job = (n: number) =>
      lock.run(async () => {
        running++;
        max = Math.max(max, running);
        await tick();
        order.push(n);
        running--;
      });
    await Promise.all([job(1), job(2), job(3), job(4)]);
    expect(max).toBe(1);
    expect(order).toEqual([1, 2, 3, 4]);
  });

  it("frees the lock when the work throws", async () => {
    const lock = createAiLock();
    await expect(
      lock.run(async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(await lock.run(async () => "ok")).toBe("ok");
  });

  it("counts the ones waiting", async () => {
    const lock = createAiLock();
    let open: () => void = () => {};
    const first = lock.run(
      () =>
        new Promise<void>((r) => {
          open = r;
        }),
    );
    const second = lock.run(async () => {});
    await tick();
    expect(lock.waiting()).toBe(1);
    open();
    await Promise.all([first, second]);
    expect(lock.waiting()).toBe(0);
  });
});
