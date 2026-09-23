import "server-only";
import { createDb, type Database } from "@radev/db";

// Reuse one pool across hot reloads in development.
const globalForDb = globalThis as unknown as { radevDb?: Database };

export const db: Database = globalForDb.radevDb ?? createDb().db;

if (process.env.NODE_ENV !== "production") globalForDb.radevDb = db;
