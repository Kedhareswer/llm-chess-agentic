import { z } from "zod";
import type { Game, Model, Move } from "@/db/schema";
import { SkillModeSchema } from "@/lib/modes";

// Shared enum schema for the `?status=` query param, matching the DB enum.
export const GameStatusSchema = z.enum(["active", "complete"]);
export type GameStatus = z.infer<typeof GameStatusSchema>;

// Request schemas
export const StartGameRequestSchema = z
  .object({
    modelIds: z.array(z.string()).min(2, "At least two models required"),
    groqApiKey: z.string().optional(), // Optional API key for Groq models
    geminiApiKey: z.string().optional(), // Optional API key for Gemini models
    whiteMode: SkillModeSchema.optional(), // Skill mode for white player
    blackMode: SkillModeSchema.optional(), // Skill mode for black player
  })
  .refine((data) => data.modelIds[0] !== data.modelIds[1], {
    message: "A model cannot play against itself; pick two different models",
    path: ["modelIds"],
  });

export const SetAPIKeyRequestSchema = z.object({
  key: z.string().min(1, "API key cannot be empty"),
});

export const ToggleModelRequestSchema = z.object({
  id: z.string(),
  active: z.boolean(),
});

// Response types
export interface APIResponse<T = unknown> {
  success?: boolean;
  error?: string;
  data?: T;
}

export interface GameDetailResponse {
  game: Game;
  moves: Move[];
  white: Model;
  black: Model;
}

export interface GamesListResponse {
  games: Game[];
}

export interface LeaderboardResponse {
  models: Model[];
}

export interface TournamentStatusResponse {
  status: "running" | "stopped";
  tickCount: number;
  tickIntervalSec: number;
  lastTickAt: string | null;
  nextTickAt: string | null;
}