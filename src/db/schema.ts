import { pgTable, text, integer, uuid, timestamp, pgEnum, boolean } from "drizzle-orm/pg-core";
import { STARTING_FEN } from "@/lib/chess";

export const tournamentStatusEnum = pgEnum("tournament_status", ["stopped", "running"]);
export const gameStatusEnum = pgEnum("game_status", ["active", "complete"]);
export const gameResultEnum = pgEnum("game_result", ["1-0", "0-1", "1/2-1/2"]);
export const colorEnum = pgEnum("color", ["white", "black"]);

export const models = pgTable("models", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  provider: text("provider").notNull(),
  elo: integer("elo").notNull().default(1500),
  gamesPlayed: integer("games_played").notNull().default(0),
  wins: integer("wins").notNull().default(0),
  losses: integer("losses").notNull().default(0),
  draws: integer("draws").notNull().default(0),
  active: boolean("active").notNull().default(true),
});

export const games = pgTable("games", {
  id: uuid("id").primaryKey().defaultRandom(),
  whiteId: text("white_id").notNull().references(() => models.id),
  blackId: text("black_id").notNull().references(() => models.id),
  pgn: text("pgn").notNull().default(""),
  fen: text("fen").notNull().default(STARTING_FEN),
  status: gameStatusEnum("status").notNull().default("active"),
  result: gameResultEnum("result"),
  resultReason: text("result_reason"),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  endedAt: timestamp("ended_at"),
  whiteTimeoutWarnings: integer("white_timeout_warnings").notNull().default(0),
  blackTimeoutWarnings: integer("black_timeout_warnings").notNull().default(0),
  groqApiKey: text("groq_api_key"), // API key for Groq models in this game
  geminiApiKey: text("gemini_api_key"), // API key for Gemini models in this game
});

export const moves = pgTable("moves", {
  id: uuid("id").primaryKey().defaultRandom(),
  gameId: uuid("game_id").notNull().references(() => games.id),
  modelId: text("model_id").notNull().references(() => models.id),
  color: colorEnum("color").notNull(), // Which side made this move: white or black
  moveNumber: integer("move_number").notNull(),
  moveSan: text("move_san").notNull(),
  fenAfter: text("fen_after").notNull(),
  reasoning: text("reasoning").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const tournament = pgTable("tournament", {
  id: integer("id").primaryKey().default(1),
  status: tournamentStatusEnum("status").notNull().default("stopped"),
  tickCount: integer("tick_count").notNull().default(0),
  tickIntervalSec: integer("tick_interval_sec").notNull().default(60),
  lastTickAt: timestamp("last_tick_at"),
  startedAt: timestamp("started_at"),
});

export type Model = typeof models.$inferSelect;
export type Game = typeof games.$inferSelect;
export type Move = typeof moves.$inferSelect;
export type Tournament = typeof tournament.$inferSelect;