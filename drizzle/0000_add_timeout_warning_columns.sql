CREATE TYPE "public"."game_result" AS ENUM('1-0', '0-1', '1/2-1/2');--> statement-breakpoint
CREATE TYPE "public"."game_status" AS ENUM('active', 'complete');--> statement-breakpoint
CREATE TYPE "public"."tournament_status" AS ENUM('stopped', 'running');--> statement-breakpoint
CREATE TABLE "games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"white_id" text NOT NULL,
	"black_id" text NOT NULL,
	"pgn" text DEFAULT '' NOT NULL,
	"fen" text DEFAULT 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' NOT NULL,
	"status" "game_status" DEFAULT 'active' NOT NULL,
	"result" "game_result",
	"result_reason" text,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "models" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"provider" text NOT NULL,
	"elo" integer DEFAULT 1500 NOT NULL,
	"games_played" integer DEFAULT 0 NOT NULL,
	"wins" integer DEFAULT 0 NOT NULL,
	"losses" integer DEFAULT 0 NOT NULL,
	"draws" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "moves" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"model_id" text NOT NULL,
	"move_number" integer NOT NULL,
	"move_san" text NOT NULL,
	"fen_after" text NOT NULL,
	"reasoning" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tournament" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"status" "tournament_status" DEFAULT 'stopped' NOT NULL,
	"tick_count" integer DEFAULT 0 NOT NULL,
	"tick_interval_sec" integer DEFAULT 60 NOT NULL,
	"last_tick_at" timestamp,
	"started_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_white_id_models_id_fk" FOREIGN KEY ("white_id") REFERENCES "public"."models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_black_id_models_id_fk" FOREIGN KEY ("black_id") REFERENCES "public"."models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moves" ADD CONSTRAINT "moves_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moves" ADD CONSTRAINT "moves_model_id_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."models"("id") ON DELETE no action ON UPDATE no action;