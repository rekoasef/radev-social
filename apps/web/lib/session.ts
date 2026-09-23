import "server-only";
import { isOperator } from "@radev/core";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { type AuthSession, allowedEmails, auth } from "./auth";

/**
 * Server-side gate for every panel page. The proxy only checks that a cookie exists; this
 * validates the session against the database and the current allowlist, so removing an
 * email from ALLOWED_EMAILS locks it out even with a live session.
 */
export async function requireOperator(): Promise<AuthSession> {
  const current = await auth.api.getSession({ headers: await headers() });
  if (!current || !isOperator(current.user, allowedEmails)) redirect("/login");
  return current;
}
