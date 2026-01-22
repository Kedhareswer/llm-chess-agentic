let groqApiKey: string | null = null;

export function setGroqApiKey(key: string) {
  groqApiKey = key.trim();
}

export function getGroqApiKey(): string | undefined {
  return groqApiKey || process.env.GROQ_API_KEY || undefined;
}
