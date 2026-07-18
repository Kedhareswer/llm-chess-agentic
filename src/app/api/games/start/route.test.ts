import { describe, it, expect, beforeEach, vi, beforeAll } from 'vitest';
import { POST } from './route';
import { db } from '@/db';
import { games, models, moves } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';

// Mock the game processor to avoid actual AI calls
vi.mock('@/lib/game-processor', () => ({
  processGame: vi.fn().mockResolvedValue(undefined),
}));

/**
 * Integration tests for game start endpoint
 * 
 * These tests require a DATABASE_URL environment variable to run.
 * They test the race condition fix using database transactions.
 * 
 * To run these tests:
 * 1. Set DATABASE_URL in your environment
 * 2. Ensure the database has seeded models
 * 3. Run: pnpm test src/app/api/games/start/route.test.ts
 */
describe('POST /api/games/start', () => {
  const hasDatabase = !!process.env.DATABASE_URL;

  beforeAll(() => {
    if (!hasDatabase) {
      console.warn('⚠️  Skipping integration tests: DATABASE_URL not set');
      console.warn('   Set DATABASE_URL to run these tests');
    }
  });

  beforeEach(async () => {
    if (!hasDatabase) return;
    
    try {
      // Clean up any active games before each test
      // First delete moves, then games to avoid foreign key constraint violations
      const activeGames = await db.select({ id: games.id }).from(games).where(eq(games.status, 'active'));
      
      if (activeGames.length > 0) {
        const gameIds = activeGames.map(g => g.id);
        // Delete moves first
        await db.delete(moves).where(inArray(moves.gameId, gameIds));
        // Then delete games
        await db.delete(games).where(eq(games.status, 'active'));
      }
    } catch (error) {
      console.error('Failed to clean up games:', error);
    }
  });

  it('should reject request with less than 2 models', async () => {
    const request = new Request('http://localhost:3000/api/games/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modelIds: ['model1'],
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('At least two models required');
  });

  it('should handle malformed request body', async () => {
    const request = new Request('http://localhost:3000/api/games/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'invalid json',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid input: expected object, received null');
  });

  it.skipIf(!hasDatabase)('should create a game successfully with valid models', async () => {
    // Get two active models from the database
    const activeModels = await db
      .select()
      .from(models)
      .where(eq(models.active, true))
      .limit(2);

    if (activeModels.length < 2) {
      console.warn('Skipping test: not enough active models in database');
      return;
    }

    const request = new Request('http://localhost:3000/api/games/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modelIds: [activeModels[0].id, activeModels[1].id],
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.gameId).toBeDefined();
    expect(data.white).toBeDefined();
    expect(data.black).toBeDefined();
    expect(data.white).not.toBe(data.black);
  });

  it.skipIf(!hasDatabase)('should reject request when a game is already active', async () => {
    // Get two active models
    const activeModels = await db
      .select()
      .from(models)
      .where(eq(models.active, true))
      .limit(2);

    if (activeModels.length < 2) {
      console.warn('Skipping test: not enough active models in database');
      return;
    }

    // Create first game
    const request1 = new Request('http://localhost:3000/api/games/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modelIds: [activeModels[0].id, activeModels[1].id],
      }),
    });

    const response1 = await POST(request1);
    expect(response1.status).toBe(200);

    // Try to create second game
    const request2 = new Request('http://localhost:3000/api/games/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modelIds: [activeModels[0].id, activeModels[1].id],
      }),
    });

    const response2 = await POST(request2);
    const data2 = await response2.json();

    expect(response2.status).toBe(400);
    expect(data2.error).toBe('A game is already running');
  });

  it.skipIf(!hasDatabase)('should prevent race condition with concurrent requests', { timeout: 15000 }, async () => {
    // Get two active models
    const activeModels = await db
      .select()
      .from(models)
      .where(eq(models.active, true))
      .limit(2);

    if (activeModels.length < 2) {
      console.warn('Skipping test: not enough active models in database');
      return;
    }

    // Create multiple concurrent requests
    const requests = Array.from({ length: 5 }, () =>
      new Request('http://localhost:3000/api/games/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelIds: [activeModels[0].id, activeModels[1].id],
        }),
      })
    );

    // Execute all requests concurrently
    const responses = await Promise.all(requests.map(req => POST(req)));
    const results = await Promise.all(responses.map(res => res.json()));

    // Log results for debugging
    console.log('Race condition test results:', results.map((r, i) => ({
      index: i,
      success: r.success,
      error: r.error,
      gameId: r.gameId
    })));

    // Count successful and failed responses
    const successful = results.filter(r => r.success === true);
    const failed = results.filter(r => r.error === 'A game is already running');

    console.log(`Successful: ${successful.length}, Failed: ${failed.length}`);

    // Exactly one should succeed, the rest should fail
    expect(successful.length).toBe(1);
    expect(failed.length).toBe(4);

    // Verify only one game was created in the database
    const activeGames = await db
      .select()
      .from(games)
      .where(eq(games.status, 'active'));

    console.log(`Active games in database: ${activeGames.length}`);
    console.log('Active games:', activeGames.map(g => ({ id: g.id, whiteId: g.whiteId, blackId: g.blackId })));
    expect(activeGames.length).toBe(1);
  });

  it.skipIf(!hasDatabase)('should handle high concurrency load (10 simultaneous requests)', { timeout: 20000 }, async () => {
    // Get two active models
    const activeModels = await db
      .select()
      .from(models)
      .where(eq(models.active, true))
      .limit(2);

    if (activeModels.length < 2) {
      console.warn('Skipping test: not enough active models in database');
      return;
    }

    // Create 10 concurrent requests to stress test the locking mechanism
    const requests = Array.from({ length: 10 }, () =>
      new Request('http://localhost:3000/api/games/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelIds: [activeModels[0].id, activeModels[1].id],
        }),
      })
    );

    // Execute all requests concurrently
    const responses = await Promise.all(requests.map(req => POST(req)));
    const results = await Promise.all(responses.map(res => res.json()));

    // Count successful and failed responses
    const successful = results.filter(r => r.success === true);
    const failed = results.filter(r => r.error === 'A game is already running');

    console.log(`High concurrency test - Successful: ${successful.length}, Failed: ${failed.length}`);

    // Exactly one should succeed, the rest should fail
    expect(successful.length).toBe(1);
    expect(failed.length).toBe(9);

    // Verify only one game was created in the database
    const activeGames = await db
      .select()
      .from(games)
      .where(eq(games.status, 'active'));

    expect(activeGames.length).toBe(1);
  });

  it.skipIf(!hasDatabase)('should handle mixed valid and invalid concurrent requests', { timeout: 15000 }, async () => {
    // Get active models
    const activeModels = await db
      .select()
      .from(models)
      .where(eq(models.active, true))
      .limit(2);

    if (activeModels.length < 2) {
      console.warn('Skipping test: not enough active models in database');
      return;
    }

    // Create mix of valid and invalid requests
    const requests = [
      // 3 valid requests
      ...Array.from({ length: 3 }, () =>
        new Request('http://localhost:3000/api/games/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            modelIds: [activeModels[0].id, activeModels[1].id],
          }),
        })
      ),
      // 2 invalid requests (only 1 model)
      ...Array.from({ length: 2 }, () =>
        new Request('http://localhost:3000/api/games/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            modelIds: [activeModels[0].id],
          }),
        })
      ),
    ];

    // Execute all requests concurrently
    const responses = await Promise.all(requests.map(req => POST(req)));
    const results = await Promise.all(responses.map(res => res.json()));

    // Count different types of responses
    const gameCreated = results.filter(r => r.success === true);
    const gameAlreadyRunning = results.filter(r => r.error === 'A game is already running');
    const invalidRequest = results.filter(r => r.error === 'Select at least two models');

    console.log(`Mixed requests test - Created: ${gameCreated.length}, Already running: ${gameAlreadyRunning.length}, Invalid: ${invalidRequest.length}`);

    // Exactly one game should be created, 2 should be invalid, 2 should be rejected due to existing game
    expect(gameCreated.length).toBe(1);
    expect(invalidRequest.length).toBe(2);
    expect(gameAlreadyRunning.length).toBe(2);

    // Verify only one game was created in the database
    const activeGames = await db
      .select()
      .from(games)
      .where(eq(games.status, 'active'));

    expect(activeGames.length).toBe(1);
  });

  it.skipIf(!hasDatabase)('should reject request with inactive models', async () => {
    // Get an inactive model
    const inactiveModels = await db
      .select()
      .from(models)
      .where(eq(models.active, false))
      .limit(1);

    const activeModels = await db
      .select()
      .from(models)
      .where(eq(models.active, true))
      .limit(1);

    if (inactiveModels.length === 0 || activeModels.length === 0) {
      console.warn('Skipping test: need both active and inactive models');
      return;
    }

    const request = new Request('http://localhost:3000/api/games/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modelIds: [activeModels[0].id, inactiveModels[0].id],
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Selected models must exist and be active');
  });

  it.skipIf(!hasDatabase)('should deduplicate model IDs', async () => {
    const activeModels = await db
      .select()
      .from(models)
      .where(eq(models.active, true))
      .limit(2);

    if (activeModels.length < 2) {
      console.warn('Skipping test: not enough active models in database');
      return;
    }

    // Send duplicate model IDs
    const request = new Request('http://localhost:3000/api/games/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modelIds: [
          activeModels[0].id,
          activeModels[0].id,
          activeModels[1].id,
        ],
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.white).not.toBe(data.black);
  });
});
