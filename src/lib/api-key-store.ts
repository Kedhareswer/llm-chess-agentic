/**
 * Optional server-wide API key fallback, read from environment variables only.
 *
 * Keys are bring-your-own: users supply their own key per match (stored
 * encrypted on that game), and the game processor prefers those. These env
 * fallbacks exist purely for local dev / self-hosting where the operator wants
 * every game to use one key without typing it each time. There is intentionally
 * no HTTP endpoint to set a global key — only per-game keys are settable, so a
 * stranger can never overwrite a shared key.
 */

/** Gets the Groq API key from the environment, if configured. */
export async function getGroqApiKey(): Promise<string | undefined> {
  return process.env.GROQ_API_KEY || undefined;
}

/** Gets the Gemini API key from the environment, if configured. */
export async function getGeminiApiKey(): Promise<string | undefined> {
  return process.env.GEMINI_API_KEY || undefined;
}
