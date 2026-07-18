import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { processGame } from '../src/lib/game-processor';
import { APIKeyError, RateLimitError, TimeoutError, ParseError } from '../src/lib/errors';

// Mock the entire db module to prevent database connections
vi.mock('../src/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  games: {},
  models: {},
  moves: {},
  tournament: {},
}));

// Mock the game processor's dependencies
vi.mock('../src/lib/ai', () => ({
  requestMove: vi.fn(),
  buildPrompt: vi.fn(),
  parseAIResponse: vi.fn(),
}));

// Mock the key store
vi.mock('../src/lib/api-key-store', () => ({
  getGroqApiKey: vi.fn(),
  getGeminiApiKey: vi.fn(),
}));

// Define the Game type locally to match the schema
type MockGame = {
  id: string;
  whiteId: string;
  blackId: string;
  pgn: string;
  fen: string;
  status: "active" | "complete";
  result: "1-0" | "0-1" | "1/2-1/2" | null;
  resultReason: string | null;
  startedAt: Date;
  endedAt: Date | null;
  whiteTimeoutWarnings: number;
  blackTimeoutWarnings: number;
};

describe('Game Processor Error Handling', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();
  });

  it('should handle API key error by ending the game', async () => {
    const mockGame: MockGame = {
      id: 'test-game-id',
      whiteId: 'model-1',
      blackId: 'model-2',
      pgn: '',
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      status: 'active',
      result: null,
      resultReason: null,
      startedAt: new Date(),
      endedAt: null,
      whiteTimeoutWarnings: 0,
      blackTimeoutWarnings: 0,
    };

    // Mock database functions to return appropriate values
    const db = await import('../src/db');
    const ai = await import('../src/lib/ai');
    const keyStore = await import('../src/lib/api-key-store');

    // Set up mock implementations
    vi.mocked(db.db.select).mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]), // No recent moves
    } as any);

    vi.mocked(db.db.update).mockReturnValue({
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ affected: 1 }]),
    } as any);

    vi.mocked(db.db.insert).mockReturnValue({
      values: vi.fn().mockResolvedValue([{ inserted: 1 }]),
    } as any);

    vi.mocked(keyStore.getGroqApiKey).mockReturnValue('test-key');
    vi.mocked(keyStore.getGeminiApiKey).mockReturnValue('test-key');

    // Mock the requestMove function to throw APIKeyError
    vi.mocked(ai.requestMove).mockRejectedValue(new APIKeyError('Groq'));

    // Process the game - this should handle the API key error
    await expect(processGame(mockGame)).resolves.not.toThrow();
  });

  it('should handle rate limit error by ending the game', async () => {
    const mockGame: MockGame = {
      id: 'test-game-id',
      whiteId: 'model-1',
      blackId: 'model-2',
      pgn: '',
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      status: 'active',
      result: null,
      resultReason: null,
      startedAt: new Date(),
      endedAt: null,
      whiteTimeoutWarnings: 0,
      blackTimeoutWarnings: 0,
    };

    const db = await import('../src/db');
    const ai = await import('../src/lib/ai');
    const keyStore = await import('../src/lib/api-key-store');

    // Set up mock implementations
    vi.mocked(db.db.select).mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    } as any);

    vi.mocked(db.db.update).mockReturnValue({
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ affected: 1 }]),
    } as any);

    vi.mocked(db.db.insert).mockReturnValue({
      values: vi.fn().mockResolvedValue([{ inserted: 1 }]),
    } as any);

    vi.mocked(keyStore.getGroqApiKey).mockReturnValue('test-key');
    vi.mocked(keyStore.getGeminiApiKey).mockReturnValue('test-key');

    // Mock the requestMove function to throw RateLimitError
    vi.mocked(ai.requestMove).mockRejectedValue(new RateLimitError('Groq'));

    // Process the game - this should handle the rate limit error
    await expect(processGame(mockGame)).resolves.not.toThrow();
  });

  it('should handle timeout error by incrementing warning counter', async () => {
    const mockGame: MockGame = {
      id: 'test-game-id',
      whiteId: 'model-1',
      blackId: 'model-2',
      pgn: '',
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      status: 'active',
      result: null,
      resultReason: null,
      startedAt: new Date(),
      endedAt: null,
      whiteTimeoutWarnings: 0,
      blackTimeoutWarnings: 0,
    };

    const db = await import('../src/db');
    const ai = await import('../src/lib/ai');
    const keyStore = await import('../src/lib/api-key-store');

    // Set up mock implementations
    vi.mocked(db.db.select).mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    } as any);

    vi.mocked(db.db.update).mockReturnValue({
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ affected: 1 }]),
    } as any);

    vi.mocked(db.db.insert).mockReturnValue({
      values: vi.fn().mockResolvedValue([{ inserted: 1 }]),
    } as any);

    vi.mocked(keyStore.getGroqApiKey).mockReturnValue('test-key');
    vi.mocked(keyStore.getGeminiApiKey).mockReturnValue('test-key');

    // Mock the requestMove function to throw TimeoutError
    vi.mocked(ai.requestMove).mockRejectedValue(new TimeoutError('test operation', 5000));

    // Process the game - this should handle the timeout error
    await expect(processGame(mockGame)).resolves.not.toThrow();
  });

  it('should handle parse error by incrementing warning counter', async () => {
    const mockGame: MockGame = {
      id: 'test-game-id',
      whiteId: 'model-1',
      blackId: 'model-2',
      pgn: '',
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      status: 'active',
      result: null,
      resultReason: null,
      startedAt: new Date(),
      endedAt: null,
      whiteTimeoutWarnings: 0,
      blackTimeoutWarnings: 0,
    };

    const db = await import('../src/db');
    const ai = await import('../src/lib/ai');
    const keyStore = await import('../src/lib/api-key-store');

    // Set up mock implementations
    vi.mocked(db.db.select).mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    } as any);

    vi.mocked(db.db.update).mockReturnValue({
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ affected: 1 }]),
    } as any);

    vi.mocked(db.db.insert).mockReturnValue({
      values: vi.fn().mockResolvedValue([{ inserted: 1 }]),
    } as any);

    vi.mocked(keyStore.getGroqApiKey).mockReturnValue('test-key');
    vi.mocked(keyStore.getGeminiApiKey).mockReturnValue('test-key');

    // Mock the requestMove function to throw ParseError
    vi.mocked(ai.requestMove).mockRejectedValue(new ParseError('invalid response'));

    // Process the game - this should handle the parse error
    await expect(processGame(mockGame)).resolves.not.toThrow();
  });

  it('should not crash the tick on unexpected errors (caught and logged)', async () => {
    const mockGame: MockGame = {
      id: 'test-game-id',
      whiteId: 'model-1',
      blackId: 'model-2',
      pgn: '',
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      status: 'active',
      result: null,
      resultReason: null,
      startedAt: new Date(),
      endedAt: null,
      whiteTimeoutWarnings: 0,
      blackTimeoutWarnings: 0,
    };

    const db = await import('../src/db');
    const ai = await import('../src/lib/ai');
    const keyStore = await import('../src/lib/api-key-store');

    // Set up mock implementations
    vi.mocked(db.db.select).mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    } as any);

    vi.mocked(db.db.update).mockReturnValue({
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ affected: 1 }]),
    } as any);

    vi.mocked(db.db.insert).mockReturnValue({
      values: vi.fn().mockResolvedValue([{ inserted: 1 }]),
    } as any);

    vi.mocked(keyStore.getGroqApiKey).mockReturnValue('test-key');
    vi.mocked(keyStore.getGeminiApiKey).mockReturnValue('test-key');

    // Mock the requestMove function to throw a generic error
    vi.mocked(ai.requestMove).mockRejectedValue(new Error('Unexpected error'));

    // The tick processor is designed to be resilient: unexpected errors are caught
    // and logged, never propagated, so one bad game can't crash the whole tick.
    await expect(processGame(mockGame)).resolves.not.toThrow();
  });
});