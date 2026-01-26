-- Migration: Add color column to moves table
-- This allows correct filtering when the same model plays both sides

-- Step 1: Create the color enum type
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'color') THEN
        CREATE TYPE "color" AS ENUM('white', 'black');
    END IF;
END $$;

-- Step 2: Add the color column as nullable first
ALTER TABLE "moves" ADD COLUMN IF NOT EXISTS "color" "color";

-- Step 3: Backfill existing moves based on fen_after
-- In FEN, the second field indicates whose turn it is AFTER the move
-- If it's 'b' (black's turn), white just moved
-- If it's 'w' (white's turn), black just moved
UPDATE "moves"
SET "color" = CASE 
    WHEN split_part("fen_after", ' ', 2) = 'b' THEN 'white'::"color"
    WHEN split_part("fen_after", ' ', 2) = 'w' THEN 'black'::"color"
END
WHERE "color" IS NULL;

-- Step 4: Make the column NOT NULL
ALTER TABLE "moves" ALTER COLUMN "color" SET NOT NULL;
