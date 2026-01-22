let groqApiKey: string | null = null;
let geminiApiKey: string | null = null;

export function setGroqApiKey(key: string) {
  groqApiKey = key.trim();
}

export function getGroqApiKey(): string | undefined {
  return groqApiKey || process.env.GROQ_API_KEY || undefined;
}

export function setGeminiApiKey(key: string) {
  geminiApiKey = key.trim();
}

export function getGeminiApiKey(): string | undefined {
  return geminiApiKey || process.env.GEMINI_API_KEY || undefined;
}
