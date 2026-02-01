import { db } from "@/db";
import { tournament } from "@/db/schema";
import { eq } from "drizzle-orm";

// Cache for API keys to avoid repeated DB queries
let groqApiKeyCache: string | null | undefined = undefined;
let geminiApiKeyCache: string | null | undefined = undefined;

/**
 * Sets the Groq API key in the database (tournament table, id=1).
 * Also updates the in-memory cache.
 */
export async function setGroqApiKey(key: string): Promise<void> {
  const trimmedKey = key.trim();
  groqApiKeyCache = trimmedKey;
  
  // Upsert: update if tournament row exists (id=1), otherwise insert
  await db
    .insert(tournament)
    .values({ id: 1, groqApiKey: trimmedKey })
    .onConflictDoUpdate({
      target: tournament.id,
      set: { groqApiKey: trimmedKey },
    });
}

/**
 * Gets the Groq API key from database (with cache fallback), then environment variable.
 */
export async function getGroqApiKey(): Promise<string | undefined> {
  // Return cached value if available
  if (groqApiKeyCache !== undefined) {
    return groqApiKeyCache || process.env.GROQ_API_KEY || undefined;
  }
  
  // Fetch from database
  const [tournamentRow] = await db
    .select({ groqApiKey: tournament.groqApiKey })
    .from(tournament)
    .where(eq(tournament.id, 1))
    .limit(1);
  
  groqApiKeyCache = tournamentRow?.groqApiKey || null;
  return groqApiKeyCache || process.env.GROQ_API_KEY || undefined;
}

/**
 * Sets the Gemini API key in the database (tournament table, id=1).
 * Also updates the in-memory cache.
 */
export async function setGeminiApiKey(key: string): Promise<void> {
  const trimmedKey = key.trim();
  geminiApiKeyCache = trimmedKey;
  
  // Upsert: update if tournament row exists (id=1), otherwise insert
  await db
    .insert(tournament)
    .values({ id: 1, geminiApiKey: trimmedKey })
    .onConflictDoUpdate({
      target: tournament.id,
      set: { geminiApiKey: trimmedKey },
    });
}

/**
 * Gets the Gemini API key from database (with cache fallback), then environment variable.
 */
export async function getGeminiApiKey(): Promise<string | undefined> {
  // Return cached value if available
  if (geminiApiKeyCache !== undefined) {
    return geminiApiKeyCache || process.env.GEMINI_API_KEY || undefined;
  }
  
  // Fetch from database
  const [tournamentRow] = await db
    .select({ geminiApiKey: tournament.geminiApiKey })
    .from(tournament)
    .where(eq(tournament.id, 1))
    .limit(1);
  
  geminiApiKeyCache = tournamentRow?.geminiApiKey || null;
  return geminiApiKeyCache || process.env.GEMINI_API_KEY || undefined;
}
