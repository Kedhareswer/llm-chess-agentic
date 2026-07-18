import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

/**
 * Optional at-rest encryption for secrets (API keys) stored in the database.
 *
 * Format: `enc:v1:<iv_b64>:<tag_b64>:<ciphertext_b64>` (AES-256-GCM).
 *
 * Backward/forward compatible by design:
 * - If `ENCRYPTION_KEY` is not set, values are stored/returned as plaintext, so
 *   existing deployments keep working unchanged.
 * - `decryptSecret` returns any value that is not in the `enc:v1:` format verbatim,
 *   so previously-stored plaintext keys still decrypt (as themselves).
 */

const PREFIX = "enc:v1:";

function getKey(): Buffer | null {
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret) return null;
  // Derive a stable 32-byte key from the configured secret.
  return createHash("sha256").update(secret).digest();
}

/** Encrypts a secret if ENCRYPTION_KEY is configured; otherwise returns it unchanged. */
export function encryptSecret(plaintext: string): string {
  const key = getKey();
  if (!key) return plaintext;

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${ciphertext.toString("base64")}`;
}

/**
 * Decrypts a value produced by `encryptSecret`. Values that are not in the
 * `enc:v1:` format (e.g. legacy plaintext) are returned unchanged.
 */
export function decryptSecret(value: string | null | undefined): string | null {
  if (value == null) return null;
  if (!value.startsWith(PREFIX)) return value; // legacy plaintext

  const key = getKey();
  if (!key) {
    // Encrypted value present but no key to read it — fail closed.
    console.warn("[crypto] Encountered an encrypted secret but ENCRYPTION_KEY is not set.");
    return null;
  }

  try {
    const [, , ivB64, tagB64, ctB64] = value.split(":");
    const iv = Buffer.from(ivB64, "base64");
    const tag = Buffer.from(tagB64, "base64");
    const ciphertext = Buffer.from(ctB64, "base64");
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plaintext.toString("utf8");
  } catch (err) {
    console.error("[crypto] Failed to decrypt secret:", err);
    return null;
  }
}
