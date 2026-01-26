ALTER TABLE "games" ADD COLUMN "white_timeout_warnings" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "black_timeout_warnings" integer DEFAULT 0 NOT NULL;