import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (!_db) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is not set");
    }
    const sql = postgres(process.env.DATABASE_URL, {
      max: 10, // Maximum number of connections in pool
      idle_timeout: 30, // Close idle connections after 30 seconds
      connect_timeout: 30, // Timeout for establishing connection (30 seconds - needed for Neon serverless cold starts)
      query_timeout: 30000, // Query timeout (30 seconds)
      transform: {
        undefined: null, // Transform undefined to null for PostgreSQL compatibility
      },
    });
    _db = drizzle(sql, { schema });
  }
  return _db;
}

// For backwards compatibility, export db as a getter
export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_, prop) {
    return (getDb() as any)[prop];
  }
});
