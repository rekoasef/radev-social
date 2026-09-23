// pg-boss worker: generation, render, publishing and metrics jobs. For now it only connects,
// prepares pg-boss's schema and waits; jobs arrive from phase 2 on.
import { PgBoss } from "pg-boss";
import { createLogger } from "./logger";

const log = createLogger({ service: "worker" });

/** Time given to running jobs to finish before shutting down anyway. */
const SHUTDOWN_TIMEOUT_MS = 30_000;

function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL no está definida. Revisá tu .env (ver .env.example).");
  return url;
}

async function main() {
  const boss = new PgBoss({
    connectionString: requireDatabaseUrl(),
    // Its own schema, so its tables never mix with ours (created on first start).
    schema: "pgboss",
    application_name: "radev-worker",
  });

  boss.on("error", (error) => log.error("pg-boss error", { error }));
  boss.on("warning", (warning) => log.warn("pg-boss warning", { ...warning }));

  await boss.start();
  log.info("worker ready", { schema: "pgboss", schemaVersion: await boss.schemaVersion() });

  let stopping = false;
  const shutdown = async (signal: NodeJS.Signals) => {
    if (stopping) return;
    stopping = true;
    log.info("shutting down", { signal, timeoutMs: SHUTDOWN_TIMEOUT_MS });
    try {
      await boss.stop({ graceful: true, timeout: SHUTDOWN_TIMEOUT_MS });
      log.info("worker stopped");
      process.exit(0);
    } catch (error) {
      log.error("unclean shutdown", { error });
      process.exit(1);
    }
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error: unknown) => {
  log.error("worker failed to start", { error });
  process.exit(1);
});
