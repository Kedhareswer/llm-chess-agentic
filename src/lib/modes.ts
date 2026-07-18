import { z } from "zod";

/**
 * Skill modes. These were previously UI-only theater — the dropdown existed
 * but the value was dropped by the start route. Now each mode really changes
 * play: sampling temperature, how many engine-screened candidate moves the
 * model may choose from, and whether obvious material blunders get one
 * warn-and-retry from the judge.
 */

export const SkillModeSchema = z.enum([
  "novice",
  "apprentice",
  "scholar",
  "strategist",
  "virtuoso",
  "grandmaster",
]);
export type SkillMode = z.infer<typeof SkillModeSchema>;

export const DEFAULT_MODE: SkillMode = "scholar";

export interface ModeConfig {
  temperature: number;
  /** Show only the top-N engine candidates to the model (null = full legal list). */
  candidateLimit: number | null;
  /** Warn-and-retry once if the chosen move loses this many centipawns vs the best candidate (null = off). */
  blunderThresholdCp: number | null;
  persona: string;
}

export const MODES: Record<SkillMode, ModeConfig> = {
  novice: {
    temperature: 0.9,
    candidateLimit: null,
    blunderThresholdCp: null,
    persona: "You are a casual beginner. Play quickly on instinct; the occasional mistake is fine.",
  },
  apprentice: {
    temperature: 0.7,
    candidateLimit: null,
    blunderThresholdCp: 800,
    persona: "You are an improving club player. Follow opening principles and don't give pieces away for nothing.",
  },
  scholar: {
    temperature: 0.5,
    candidateLimit: null,
    blunderThresholdCp: 400,
    persona: "You are a solid tournament player. Before moving, check what your opponent attacks and keep your pieces defended.",
  },
  strategist: {
    temperature: 0.4,
    candidateLimit: 12,
    blunderThresholdCp: 300,
    persona: "You are a strong positional player. Weigh pawn structure, piece activity and king safety before committing.",
  },
  virtuoso: {
    temperature: 0.3,
    candidateLimit: 8,
    blunderThresholdCp: 250,
    persona: "You are a master-level tactician. Calculate forcing lines — checks, captures, threats — before every move.",
  },
  grandmaster: {
    temperature: 0.2,
    candidateLimit: 5,
    blunderThresholdCp: 200,
    persona: "You are a grandmaster. Choose only the objectively best move, calculating concrete variations.",
  },
};

export function modeConfig(mode: string | null | undefined): ModeConfig {
  const parsed = SkillModeSchema.safeParse(mode);
  return MODES[parsed.success ? parsed.data : DEFAULT_MODE];
}
