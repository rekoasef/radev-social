import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createDb } from "./client";
import { loadRootEnv } from "./env";

loadRootEnv();

const migrationsFolder = fileURLToPath(new URL("../migrations", import.meta.url));
const { db, pool } = createDb();

try {
  await migrate(db, { migrationsFolder });
  console.log("Migraciones aplicadas.");
} finally {
  await pool.end();
}
