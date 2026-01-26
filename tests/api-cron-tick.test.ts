import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { db } from '../src/db';
import { games, models, tournament } from '../src/db/schema';
import { resetTestData, setupTestDB, teardownTestDB } from './setup';
import { GET } from '../src/app/api/cron/tick/route';

describe('Cron Tick API', () => {
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

  it.runIf(hasDatabase)('should process active games when tournament is running', async () => {
    // Set up tournament as running
    await db.insert(tournament).values({
      id: 1,
      status: 'running',
      tickCount: 0,
      tickIntervalSec: 60,
      lastTickAt: new Date(),
      startedAt: new Date(),
    });

    // Create a model
    await db.insert(models).values({
      id: 'test-model',
      name: 'Test Model',
      provider: 'test',
      elo: 1500,
    });

    // Create an active game
    await db.insert(games).values({
      id: 'test-game-id',
      whiteId: 'test-model',
      blackId: 'test-model',
      status: 'active',
      startedAt: new Date(),
      whiteTimeoutWarnings: 0,
      blackTimeoutWarnings: 0,
    });

    // Create a mock request object
    const mockRequest = {
      url: 'http://localhost:3000/api/cron/tick'
    } as unknown as Request;

    // Call the GET function directly
    const response = await GET(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('processed');
    expect(typeof data.processed).toBe('number');
  });

  it.runIf(hasDatabase)('should return 0 processed when tournament is stopped', async () => {
    // Set up tournament as stopped
    await db.insert(tournament).values({
      id: 1,
      status: 'stopped',
      tickCount: 0,
      tickIntervalSec: 60,
      lastTickAt: new Date(),
      startedAt: null,
    });

    // Create a mock request object
    const mockRequest = {
      url: 'http://localhost:3000/api/cron/tick'
    } as unknown as Request;

    // Call the GET function directly
    const response = await GET(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ processed: 0 });
  });

  it.runIf(hasDatabase)('should return 0 processed when no active games', async () => {
    // Set up tournament as running
    await db.insert(tournament).values({
      id: 1,
      status: 'running',
      tickCount: 0,
      tickIntervalSec: 60,
      lastTickAt: new Date(),
      startedAt: new Date(),
    });

    // Create a mock request object
    const mockRequest = {
      url: 'http://localhost:3000/api/cron/tick'
    } as unknown as Request;

    // Call the GET function directly
    const response = await GET(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ processed: 0 });
  });
});