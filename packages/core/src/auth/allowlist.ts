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
