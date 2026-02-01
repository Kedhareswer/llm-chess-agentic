-- Add API key columns to tournament table
ALTER TABLE "tournament" ADD COLUMN "groq_api_key" text;
ALTER TABLE "tournament" ADD COLUMN "gemini_api_key" text;
