import { db } from "@/db";
import { tournament } from "@/db/schema";
import { eq } from "drizzle-orm";
import { encryptSecret, decryptSecret } from "@/lib/crypto";

/**
 * Global (server-wide) API keys stored in the singleton tournament row (id=1).
 *
 * Notes:
 * - Keys are encrypted at rest when ENCRYPTION_KEY is configured (see crypto.ts);
 *   otherwise stored as plaintext for backward compatibility.
 * - There is intentionally NO module-level cache. A mutable module singleton is
 *   shared across all requests on a warm serverless instance, which previously
 *   risked one caller's key being served to another. Reading fresh per call is
 *   both safe and cheap (at most a couple of lookups per move).
 */

/** Sets the global Groq API key (encrypted at rest when configured). */
export async function setGroqApiKey(key: string): Promise<void> {
  const stored = encryptSecret(key.trim());
  await db
    .insert(tournament)
    .values({ id: 1, groqApiKey: stored })
    .onConflictDoUpdate({ target: tournament.id, set: { groqApiKey: stored } });
}

/** Gets the global Groq API key from the DB, falling back to the env var. */
export async function getGroqApiKey(): Promise<string | undefined> {
  const [row] = await db
    .select({ groqApiKey: tournament.groqApiKey })
    .from(tournament)
    .where(eq(tournament.id, 1))
    .limit(1);

  return decryptSecret(row?.groqApiKey) || process.env.GROQ_API_KEY || undefined;
}

/** Sets the global Gemini API key (encrypted at rest when configured). */
export async function setGeminiApiKey(key: string): Promise<void> {
  const stored = encryptSecret(key.trim());
  await db
    .insert(tournament)
    .values({ id: 1, geminiApiKey: stored })
    .onConflictDoUpdate({ target: tournament.id, set: { geminiApiKey: stored } });
}

/** Gets the global Gemini API key from the DB, falling back to the env var. */
export async function getGeminiApiKey(): Promise<string | undefined> {
  const [row] = await db
    .select({ geminiApiKey: tournament.geminiApiKey })
    .from(tournament)
    .where(eq(tournament.id, 1))
    .limit(1);

  return decryptSecret(row?.geminiApiKey) || process.env.GEMINI_API_KEY || undefined;
}
