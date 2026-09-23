import "server-only";
import { isOperator, parseAllowedEmails } from "@radev/core";
import { account, session, user, verification } from "@radev/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "./db";
import { requireEnv } from "./env";

export const allowedEmails = parseAllowedEmails(process.env.ALLOWED_EMAILS);

export const NOT_ALLOWED = "not_allowed";

export const auth = betterAuth({
  baseURL: requireEnv("BETTER_AUTH_URL"),
  secret: requireEnv("BETTER_AUTH_SECRET"),
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user, session, account, verification },
  }),
  socialProviders: {
    github: {
      clientId: requireEnv("GITHUB_CLIENT_ID"),
      clientSecret: requireEnv("GITHUB_CLIENT_SECRET"),
    },
  },
  account: {
    // AES-256-GCM for the GitHub tokens stored in the account table (CLAUDE.md rule 10).
    encryptOAuthTokens: true,
  },
  user: {
    // Runs before creating the user and on every GitHub sign-in, with the fresh provider email.
    validateUserInfo: ({ user: identity }) => {
      if (!isOperator(identity, allowedEmails)) {
        return { error: NOT_ALLOWED, errorDescription: "Esta cuenta no tiene acceso al panel." };
      }
    },
  },
  plugins: [nextCookies()],
});

export type AuthSession = typeof auth.$Infer.Session;
