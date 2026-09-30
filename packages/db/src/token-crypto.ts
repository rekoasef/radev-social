import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Network tokens at rest (CLAUDE.md rule 10, docs/ARCHITECTURE.md §11): AES-256-GCM with the key
// in TOKEN_ENCRYPTION_KEY (32 random bytes in base64: `openssl rand -base64 32`).
//
// Stored as "v1.<base64url(iv | tag | ciphertext)>". The version leaves room to change the key or
// the format later. `context` is authenticated but not stored: a value encrypted for one purpose
// (e.g. an access token) does not decrypt as another (a refresh token).

const VERSION = "v1";
const IV_BYTES = 12;
const TAG_BYTES = 16;

/** The key from TOKEN_ENCRYPTION_KEY. Never logs it. */
export function tokenEncryptionKey(value = process.env.TOKEN_ENCRYPTION_KEY): Buffer {
  if (!value) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY no está definida. Generala con `openssl rand -base64 32` y cargala en el .env.",
    );
  }
  const key = Buffer.from(value, "base64");
  if (key.length !== 32 || key.toString("base64") !== value.trim()) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY no es válida: tienen que ser 32 bytes en base64 (`openssl rand -base64 32`).",
    );
  }
  return key;
}

export function encryptToken(plain: string, context: string, key = tokenEncryptionKey()): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(context, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const payload = Buffer.concat([iv, cipher.getAuthTag(), ciphertext]);
  return `${VERSION}.${payload.toString("base64url")}`;
}

/** Throws if the value was altered, encrypted with another key or for another context. */
export function decryptToken(stored: string, context: string, key = tokenEncryptionKey()): string {
  const [version, data, ...rest] = stored.split(".");
  if (version !== VERSION || !data || rest.length > 0) {
    throw new Error("Token cifrado con un formato desconocido.");
  }
  const payload = Buffer.from(data, "base64url");
  if (payload.length < IV_BYTES + TAG_BYTES) throw new Error("Token cifrado incompleto.");
  const decipher = createDecipheriv("aes-256-gcm", key, payload.subarray(0, IV_BYTES));
  decipher.setAAD(Buffer.from(context, "utf8"));
  decipher.setAuthTag(payload.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
  try {
    return Buffer.concat([
      decipher.update(payload.subarray(IV_BYTES + TAG_BYTES)),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    // Node's message says nothing useful; this one points at the likely cause.
    throw new Error(
      "No se pudo descifrar el token: la TOKEN_ENCRYPTION_KEY cambió o el dato está alterado.",
    );
  }
}
