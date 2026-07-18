-- Add serverless-safe processing-claim columns to games table
ALTER TABLE "games" ADD COLUMN "processing" boolean DEFAULT false NOT NULL;
ALTER TABLE "games" ADD COLUMN "processing_started_at" timestamp;
