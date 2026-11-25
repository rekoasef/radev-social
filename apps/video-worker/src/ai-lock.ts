// One `claude -p` at a time in the whole process (docs/ARCHITECTURE.md §14.1, rule: the subscription
// is shared with the operator). A FIFO semaphore: the offices that use AI take turns whichever
// queue they come from. Commons, the downloads and the render do not use it.

export type AiLock = {
  /** Runs `work` when it is its turn; frees the lock even if `work` throws. */
  run<T>(work: () => Promise<T>): Promise<T>;
  /** How many are waiting (not counting the one running). */
  waiting(): number;
};

export function createAiLock(): AiLock {
  let running = false;
  const queue: (() => void)[] = [];

  const release = () => {
    const next = queue.shift();
    if (next) next();
    else running = false;
  };

  return {
    async run<T>(work: () => Promise<T>): Promise<T> {
      if (running) await new Promise<void>((resolve) => queue.push(resolve));
      else running = true;
      try {
        return await work();
      } finally {
        release();
      }
    },
    waiting: () => queue.length,
  };
}
