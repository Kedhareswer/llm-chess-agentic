import { execSync } from 'child_process';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.test' });

// Test database setup/teardown
let testClient: Client | null = null;

export const setupTestDB = async () => {
  // Check if TEST_DATABASE_URL is available
  if (!process.env.TEST_DATABASE_URL) {
    console.warn('TEST_DATABASE_URL not found. Skipping database-dependent tests.');
    return;
  }

  testClient = new Client({
    connectionString: process.env.TEST_DATABASE_URL,
  });
  
  try {
    await testClient.connect();
    
    // Run migrations on test database
    try {
      execSync('npx drizzle-kit migrate', { 
        env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL },
        stdio: 'pipe' // Suppress output to avoid noise
      });
    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    }
  } catch (error) {
    console.warn('Could not connect to test database. Skipping database-dependent tests.');
    return;
  }
};

export const teardownTestDB = async () => {
  if (testClient) {
    try {
      await testClient.end();
    } catch (error) {
      console.error('Error closing test database connection:', error);
    }
  }
};

export const resetTestData = async () => {
  if (testClient) {
    try {
      await testClient.query('TRUNCATE TABLE moves, games, models, tournament RESTART IDENTITY CASCADE;');
    } catch (error) {
      console.error('Error resetting test data:', error);
    }
  }
};

export const getTestDb = () => {
  if (!testClient) {
    throw new Error('Test client not initialized. Call setupTestDB first.');
  }
  return drizzle(testClient);
};