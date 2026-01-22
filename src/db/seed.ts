import { config } from "dotenv";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { models, tournament, games, moves } from "./schema";

config({ path: ".env.local" });

const sql = postgres(process.env.DATABASE_URL!);
const db = drizzle(sql);

// Model IDs: only working Groq + Gemini
const MODELS = [
  // Groq (working)
  { id: "groq/llama-3.3-70b-versatile", name: "Llama 3.3 70B Versatile", provider: "groq", active: true },
  { id: "groq/llama-3.1-8b-instant", name: "Llama 3.1 8B Instant", provider: "groq", active: true },
  { id: "groq/moonshotai/kimi-k2-instruct", name: "Kimi K2 Instruct", provider: "groq", active: true },
  { id: "groq/moonshotai/kimi-k2-instruct-0905", name: "Kimi K2 Instruct 0905", provider: "groq", active: true },
  { id: "groq/openai/gpt-oss-20b", name: "GPT-OSS 20B", provider: "groq", active: true },
  { id: "groq/openai/gpt-oss-120b", name: "GPT-OSS 120B", provider: "groq", active: true },
  { id: "groq/openai/gpt-oss-safeguard-20b", name: "GPT-OSS Safeguard 20B", provider: "groq", active: true },
  { id: "groq/meta-llama/llama-4-scout-17b-16e-instruct", name: "Llama 4 Scout 17B", provider: "groq", active: true },
  { id: "groq/meta-llama/llama-4-maverick-17b-128e-instruct", name: "Llama 4 Maverick 17B", provider: "groq", active: true },
  { id: "groq/compound", name: "Groq Compound", provider: "groq", active: true },
  { id: "groq/compound-mini", name: "Groq Compound Mini", provider: "groq", active: true },

  // Gemini (working with 20s timeout)
  { id: "google/models/gemini-2.5-pro", name: "Gemini 2.5 Pro", provider: "google", active: true },
  { id: "google/models/gemini-2.5-flash", name: "Gemini 2.5 Flash", provider: "google", active: true },
  { id: "google/models/gemini-2.0-flash", name: "Gemini 2.0 Flash", provider: "google", active: true },
  { id: "google/models/gemini-2.0-flash-001", name: "Gemini 2.0 Flash 001", provider: "google", active: true },
  { id: "google/models/gemini-2.0-flash-lite", name: "Gemini 2.0 Flash Lite", provider: "google", active: true },
  { id: "google/models/gemini-2.0-flash-lite-001", name: "Gemini 2.0 Flash Lite 001", provider: "google", active: true },
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
