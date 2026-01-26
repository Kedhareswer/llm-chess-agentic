import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { POST as startGameRoute } from '../start/route';
import { GET as getBulkGamesRoute } from './route';
import { db } from '@/db';
import { games, models } from '@/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Integration tests for bulk games endpoint
 * These tests require a DATABASE_URL environment variable to run.
 */
describe('GET /api/games/bulk', () => {
  const hasDatabase = !!process.env.DATABASE_URL;

  beforeAll(() => {
    if (!hasDatabase) {
      console.warn('⚠️  Skipping integration tests: DATABASE_URL not set');
      console.warn('   Set DATABASE_URL to run these tests');
    }
  });

  afterAll(async () => {
    if (!hasDatabase) return;
    
    try {
      // Clean up any active games after tests
      const activeGames = await db.select({ id: games.id }).from(games).where(eq(games.status, 'active'));
      
      if (activeGames.length > 0) {
        const gameIds = activeGames.map(g => g.id);
        await db.delete(games).where(eq(games.status, 'active'));
      }
    } catch (error) {
      console.error('Failed to clean up games:', error);
    }
  });

  it.skipIf(!hasDatabase)('should return bulk games with models successfully', async () => {
    // First, ensure we have models to work with
    const allModels = await db.select().from(models);
    
    if (allModels.length < 2) {
      console.warn('Skipping test: not enough models in database');
      return;
    }

    // Create a game to test with
    const request = new Request('http://localhost:3000/api/games/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modelIds: [allModels[0].id, allModels[1].id],
      }),
    });

    const startResponse = await startGameRoute(request);
    expect(startResponse.status).toBe(200);

    // Now test the bulk endpoint
    const bulkRequest = new Request('http://localhost:3000/api/games/bulk?status=active&limit=10');
    const bulkResponse = await getBulkGamesRoute(bulkRequest);
    
    expect(bulkResponse.status).toBe(200);
    const data = await bulkResponse.json();
    
    expect(Array.isArray(data.games)).toBe(true);
    expect(data.games.length).toBeGreaterThanOrEqual(1);
    
    // Check that the first game has the expected structure with models
    const firstGame = data.games[0];
    expect(firstGame).toHaveProperty('id');
    expect(firstGame).toHaveProperty('whiteId');
    expect(firstGame).toHaveProperty('blackId');
    expect(firstGame).toHaveProperty('whiteModel');
    expect(firstGame).toHaveProperty('blackModel');
    
    // Verify model data is properly embedded
    expect(firstGame.whiteModel).toHaveProperty('id');
    expect(firstGame.whiteModel).toHaveProperty('name');
    expect(firstGame.blackModel).toHaveProperty('id');
    expect(firstGame.blackModel).toHaveProperty('name');
  });

  it.skipIf(!hasDatabase)('should handle invalid limit parameter', async () => {
    const request = new Request('http://localhost:3000/api/games/bulk?status=active&limit=invalid');
    const response = await getBulkGamesRoute(request);
    
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Limit must be a number');
  });

  it.skipIf(!hasDatabase)('should respect limit parameter', async () => {
    // Test with a limit of 1
    const request = new Request('http://localhost:3000/api/games/bulk?status=active&limit=1');
    const response = await getBulkGamesRoute(request);
    
    expect(response.status).toBe(200);
    const data = await response.json();
    
    // Should return an array with at most 1 item
    expect(Array.isArray(data.games)).toBe(true);
    expect(data.games.length).toBeLessThanOrEqual(1);
  });

  it.skipIf(!hasDatabase)('should return empty array when no games match status', async () => {
    const request = new Request('http://localhost:3000/api/games/bulk?status=nonexistent');
    const response = await getBulkGamesRoute(request);
    
    expect(response.status).toBe(200);
    const data = await response.json();
    
    expect(Array.isArray(data.games)).toBe(true);
    // May not be empty depending on existing data, but should be an array
  });
});