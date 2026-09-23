/**
 * Parses the ALLOWED_EMAILS value (comma or whitespace separated) into a
 * normalized set. Emails are compared case-insensitively.
 */
export function parseAllowedEmails(raw: string | undefined): ReadonlySet<string> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(/[\s,]+/)
      .map((email) => email.trim().toLowerCase())
      .filter((email) => email.length > 0),
  );
}

export function isEmailAllowed(
  email: string | null | undefined,
  allowed: ReadonlySet<string>,
): boolean {
  if (!email) return false;
  return allowed.has(email.trim().toLowerCase());
}

export type OperatorIdentity = {
  email?: string | null | undefined;
  emailVerified?: boolean | null | undefined;
};

/**
 * The panel has a single operator: only a verified email that is in the allowlist may
 * sign in. An unverified provider email could belong to someone else.
 */
export function isOperator(identity: OperatorIdentity, allowed: ReadonlySet<string>): boolean {
  return identity.emailVerified === true && isEmailAllowed(identity.email, allowed);
}
