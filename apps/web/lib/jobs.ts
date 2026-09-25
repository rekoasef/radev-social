import "server-only";
import { carouselGenerateKey, carouselRenderKey, JOBS, QUEUE_OPTIONS } from "@radev/core";
import { PgBoss } from "pg-boss";
import { requireEnv } from "./env";

// The web only queues jobs; the worker runs them (CLAUDE.md, rule 5). A pg-boss client without
// maintenance or schema work: the worker owns that.

const globalForBoss = globalThis as unknown as { radevBoss?: Promise<PgBoss> };

function boss(): Promise<PgBoss> {
  globalForBoss.radevBoss ??= (async () => {
    const client = new PgBoss({
      connectionString: requireEnv("DATABASE_URL"),
      schema: "pgboss",
      application_name: "radev-web",
      supervise: false,
      migrate: false,
      createSchema: false,
    });
    client.on("error", (error) => console.error("pg-boss (web):", error));
    await client.start();
    // Idempotent: lets the web queue before the worker has ever started.
    await client.createQueue(JOBS.carouselRender, QUEUE_OPTIONS[JOBS.carouselRender]);
    await client.createQueue(JOBS.carouselGenerate, QUEUE_OPTIONS[JOBS.carouselGenerate]);
    return client;
  })();
  return globalForBoss.radevBoss;
}

/** Queues the render of a version. A duplicate is harmless: the job skips what is not rendering. */
export async function queueRender(versionId: string): Promise<void> {
  await (await boss()).send(
    JOBS.carouselRender,
    { versionId },
    { singletonKey: carouselRenderKey(versionId) },
  );
}

/** Queues the AI generation of a post that is `generating`. A duplicate finds nothing to do. */
export async function queueGenerate(postId: string): Promise<void> {
  await (await boss()).send(
    JOBS.carouselGenerate,
    { postId, attempt: 0 },
    { singletonKey: carouselGenerateKey(postId, 0) },
  );
}
