-- Add API key columns to games table
ALTER TABLE "games" ADD COLUMN "groq_api_key" text;
ALTER TABLE "games" ADD COLUMN "gemini_api_key" text;
