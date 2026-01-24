import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { db } from '../src/db';
import { games, models } from '../src/db/schema';
import { resetTestData, setupTestDB, teardownTestDB, getTestDb } from './setup';
import { GET } from '../src/app/api/games/bulk/route';

describe('Bulk Games API', () => {
  let hasDatabase = false;

  beforeAll(async () => {
    try {
      await setupTestDB();
      hasDatabase = true;
    } catch (error) {
      console.warn('Skipping database-dependent tests:', error);
      hasDatabase = false;
    }
  });

  afterAll(async () => {
    if (hasDatabase) {
      await teardownTestDB();
    }
  });

  beforeEach(async () => {
    if (hasDatabase) {
      await resetTestData();
    }
  });

  it.runIf(hasDatabase)('should fetch bulk games with models', async () => {
    // Create test models
    await db.insert(models).values([
      { id: 'model-1', name: 'Test Model 1', provider: 'test', elo: 1500 },
      { id: 'model-2', name: 'Test Model 2', provider: 'test', elo: 1600 },
    ]);

    // Create test games
    await db.insert(games).values([
      {
        id: '00000000-0000-0000-0000-000000000001',
        whiteId: 'model-1',
        blackId: 'model-2',
        status: 'active',
        startedAt: new Date(),
        whiteTimeoutWarnings: 0,
        blackTimeoutWarnings: 0,
      },
      {
        id: '00000000-0000-0000-0000-000000000002',
        whiteId: 'model-2',
        blackId: 'model-1',
        status: 'complete',
        result: '1-0',
        startedAt: new Date(),
        endedAt: new Date(),
        whiteTimeoutWarnings: 0,
        blackTimeoutWarnings: 0,
      }
    ]);

    // Create a mock request object
    const mockRequest = {
      url: 'http://localhost:3000/api/games/bulk'
    } as unknown as Request;

    // Call the GET function directly
    const response = await GET(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('games');
    expect(Array.isArray(data.games)).toBe(true);
    expect(data.games).toHaveLength(2);

    // Check that the games include model information
    const game = data.games[0];
    expect(game).toHaveProperty('id');
    expect(game).toHaveProperty('whiteModel');
    expect(game).toHaveProperty('blackModel');
    expect(game.whiteModel).toHaveProperty('name');
    expect(game.blackModel).toHaveProperty('name');
  });

  it.runIf(hasDatabase)('should handle empty games list', async () => {
    const mockRequest = {
      url: 'http://localhost:3000/api/games/bulk'
    } as unknown as Request;

    const response = await GET(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('games');
    expect(Array.isArray(data.games)).toBe(true);
    expect(data.games).toHaveLength(0);
  });

  it.runIf(hasDatabase)('should respect limit parameter', async () => {
    // Create test models
    await db.insert(models).values([
      { id: 'model-1', name: 'Test Model 1', provider: 'test', elo: 1500 },
      { id: 'model-2', name: 'Test Model 2', provider: 'test', elo: 1600 },
    ]);

    // Create more than the limit of test games
    for (let i = 0; i < 5; i++) {
      await db.insert(games).values({
        id: `00000000-0000-0000-0000-00000000000${i + 1}`,
        whiteId: 'model-1',
        blackId: 'model-2',
        status: 'active',
        startedAt: new Date(),
        whiteTimeoutWarnings: 0,
        blackTimeoutWarnings: 0,
      });
    }

    // Create a mock request with query parameters
    const mockRequest = {
      url: 'http://localhost:3000/api/games/bulk?limit=3'
    } as unknown as Request;

    const response = await GET(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('games');
    expect(Array.isArray(data.games)).toBe(true);
    expect(data.games).toHaveLength(3);
  });

  it.runIf(hasDatabase)('should handle invalid limit parameter', async () => {
    const mockRequest = {
      url: 'http://localhost:3000/api/games/bulk?limit=invalid'
    } as unknown as Request;

    const response = await GET(mockRequest);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data).toHaveProperty('error');
  });

  it.runIf(hasDatabase)('should handle negative limit parameter', async () => {
    const mockRequest = {
      url: 'http://localhost:3000/api/games/bulk?limit=-5'
    } as unknown as Request;

    const response = await GET(mockRequest);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data).toHaveProperty('error');
  });
});