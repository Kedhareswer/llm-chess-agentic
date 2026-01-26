import { z } from "zod";
import type { Game, Model, Move } from "@/db/schema";

// Request schemas
export const StartGameRequestSchema = z.object({
  modelIds: z.array(z.string()).min(2, "At least two models required"),
  groqApiKey: z.string().optional(), // Optional API key for Groq models
  geminiApiKey: z.string().optional(), // Optional API key for Gemini models
  whiteMode: z.string().optional(), // Optional skill mode for white player
  blackMode: z.string().optional(), // Optional skill mode for black player
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