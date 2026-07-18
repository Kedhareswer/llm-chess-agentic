import { config } from "dotenv";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { models, tournament, games, moves } from "./schema";

config({ path: ".env.local" });

const sql = postgres(process.env.DATABASE_URL!);
const db = drizzle(sql);

// Model IDs — current lineups as of July 2026.
// Groq: llama-3.x and Kimi K2 are deprecated on GroqCloud; gpt-oss and qwen3.6
// are the current chat models. Gemini: 3.x is current (3.5 Flash is GA);
// 2.5 kept as legacy opponents.
const MODELS = [
  // Groq (need GROQ_API_KEY)
  { id: "groq/openai/gpt-oss-120b", name: "GPT-OSS 120B", provider: "groq", active: true },
  { id: "groq/openai/gpt-oss-20b", name: "GPT-OSS 20B", provider: "groq", active: true },
  { id: "groq/qwen/qwen3.6-27b", name: "Qwen 3.6 27B", provider: "groq", active: true },

  // Gemini (need GEMINI_API_KEY)
  { id: "google/models/gemini-3.5-flash", name: "Gemini 3.5 Flash", provider: "google", active: true },
  { id: "google/models/gemini-3.1-pro-preview", name: "Gemini 3.1 Pro Preview", provider: "google", active: true },
  { id: "google/models/gemini-3.1-flash-lite", name: "Gemini 3.1 Flash Lite", provider: "google", active: true },
  { id: "google/models/gemini-3-flash-preview", name: "Gemini 3 Flash Preview", provider: "google", active: true },
  { id: "google/models/gemini-2.5-flash", name: "Gemini 2.5 Flash", provider: "google", active: true },
  { id: "google/models/gemini-2.5-pro", name: "Gemini 2.5 Pro", provider: "google", active: true },

  // Anthropic (Claude) — inactive by default; enable after setting ANTHROPIC_API_KEY.
  { id: "anthropic/claude-sonnet-5", name: "Claude Sonnet 5", provider: "anthropic", active: false },
  { id: "anthropic/claude-haiku-4-5", name: "Claude Haiku 4.5", provider: "anthropic", active: false },

  // OpenAI (direct) — inactive by default; enable after setting OPENAI_API_KEY.
  { id: "openai/gpt-5.6-terra", name: "GPT-5.6 Terra", provider: "openai", active: false },
  { id: "openai/gpt-5.6-luna", name: "GPT-5.6 Luna", provider: "openai", active: false },
];

async function seed() {
  console.log("Clearing existing data...");
  await db.delete(moves);
  await db.delete(games);
  await db.delete(models);

  console.log("Seeding models...");
  for (const model of MODELS) {
    await db.insert(models).values(model).onConflictDoNothing();
  }

  await db.insert(tournament).values({ id: 1 }).onConflictDoNothing();

  console.log("Seed complete!");
  await sql.end();
}

seed().catch(console.error);
