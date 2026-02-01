import { config } from "dotenv";
import { readFileSync } from "fs";
import postgres from "postgres";

config({ path: ".env.local" });

async function runMigration() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }

  const sql = postgres(process.env.DATABASE_URL, {
    max: 1,
    connect_timeout: 60,
    idle_timeout: 30,
  });

  try {
    const migration = readFileSync("drizzle/0004_add_color_to_moves.sql", "utf-8");
    console.log("Running migration...");
    await sql.unsafe(migration);
    console.log("Migration completed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runMigration();
