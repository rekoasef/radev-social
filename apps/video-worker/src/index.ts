// pg-boss worker of RAdev Studio: one queue per office of the video (ADR 0029,
// docs/ARCHITECTURE.md §14.1). Runs on the operator's notebook, apart from the social worker.
import { createLogger } from "./logger";
import { SHUTDOWN_TIMEOUT_MS, startVideoWorker } from "./start";

const log = createLogger({ service: "video-worker" });

async function main() {
  const worker = await startVideoWorker();

  let stopping = false;
  const shutdown = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    log.info("shutting down", { signal });
    const timer = setTimeout(() => {
      log.error("shutdown timed out");
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    timer.unref();
    await worker.stop();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((error) => {
  log.error("video-worker failed to start", { error });
  process.exit(1);
});
