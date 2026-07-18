ALTER TABLE "games" ADD COLUMN IF NOT EXISTS "white_mode" text NOT NULL DEFAULT 'scholar';
ALTER TABLE "games" ADD COLUMN IF NOT EXISTS "black_mode" text NOT NULL DEFAULT 'scholar';
