import fs from "node:fs";
import path from "node:path";

import type { Pool } from "pg";

const MIGRATIONS_DIR = path.join(__dirname, "..", "migrations");

async function ensureMigrationsTable(db: Pool): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

/**
 * Applies every *.sql migration in src/migrations not yet recorded in
 * schema_migrations, in filename order. Takes an explicit Pool (no default)
 * so importing this module never transitively loads src/env.ts / dotenv —
 * that matters for tests/global-setup.ts, which must control DATABASE_URL
 * itself rather than picking up whatever `.env` resolves to first.
 */
export async function runMigrations(db: Pool): Promise<string[]> {
  await ensureMigrationsTable(db);

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const { rows: appliedRows } = await db.query<{ id: string }>("SELECT id FROM schema_migrations");
  const applied = new Set(appliedRows.map((r) => r.id));

  const newlyApplied: string[] = [];

  for (const file of files) {
    if (applied.has(file)) continue;

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (id) VALUES ($1)", [file]);
      await client.query("COMMIT");
      newlyApplied.push(file);
    } catch (err) {
      await client.query("ROLLBACK");
      throw new Error(`Migration ${file} failed: ${(err as Error).message}`);
    } finally {
      client.release();
    }
  }

  return newlyApplied;
}

/** Drops and recreates the public schema — test-only, never called from CLI. */
export async function resetSchema(db: Pool): Promise<void> {
  await db.query("DROP SCHEMA public CASCADE");
  await db.query("CREATE SCHEMA public");
}

if (require.main === module) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { pool } = require("./pool") as typeof import("./pool");
  runMigrations(pool)
    .then((applied) => {
      if (applied.length === 0) {
        console.log("No new migrations to apply.");
      } else {
        console.log(`Applied ${applied.length} migration(s):`, applied.join(", "));
      }
      return pool.end();
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
