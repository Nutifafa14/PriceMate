import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";

import { Pool } from "pg";

import { resetSchema, runMigrations } from "../src/db/migrate";
import { importCommunityPrices } from "../src/seed/import-community-prices";
import { importCsv } from "../src/seed/import-csv";

// Kept in sync with vitest.config.ts's test.env.ML_API_URL by hand rather
// than read from process.env — globalSetup runs in a separate context from
// the test workers, and reading process.env here proved unreliable in
// earlier testing (see how src/db/migrate.ts's default-parameter import was
// removed for the same reason).
const ML_PORT = 8001;
const ML_HEALTH_URL = `http://127.0.0.1:${ML_PORT}/health`;
const REPO_ROOT = path.join(__dirname, "..", "..");
const ML_SRC_DIR = path.join(REPO_ROOT, "ml", "src");
const ML_UVICORN_BIN = path.join(REPO_ROOT, "ml", ".venv", "bin", "uvicorn");

async function waitForHealth(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`ML API did not become healthy at ${url} within ${timeoutMs}ms`);
}

// Runs once before the whole test run, in vitest's separate setup context —
// resets pricemate_test to a clean schema, applies every migration, runs the
// real CSV import pipeline, and spawns the real Phase 4 ML API (not a mock)
// so predictions.test.ts exercises the actual Express → ML HTTP call.
export default async function setup(): Promise<() => Promise<void>> {
  const databaseUrl = process.env.DATABASE_URL ?? "postgres://localhost:5432/pricemate_test";
  const pool = new Pool({ connectionString: databaseUrl });

  await resetSchema(pool);
  await runMigrations(pool);
  const summary = await importCsv(pool);
  const communitySummary = await importCommunityPrices(pool);
  await pool.end();

  if (summary.rowsRejected > 0) {
    throw new Error(`CSV import rejected ${summary.rowsRejected} row(s) during test setup`);
  }
  if (communitySummary.rowsRejected > 0) {
    throw new Error(
      `Community price import rejected ${communitySummary.rowsRejected} row(s) during test setup`,
    );
  }

  let mlProcess: ChildProcess | undefined;
  const alreadyRunning = await fetch(ML_HEALTH_URL)
    .then((res) => res.ok)
    .catch(() => false);

  if (!alreadyRunning) {
    mlProcess = spawn(ML_UVICORN_BIN, ["api:app", "--port", String(ML_PORT)], {
      cwd: ML_SRC_DIR,
      stdio: "ignore",
    });
    await waitForHealth(ML_HEALTH_URL, 20_000);
  }

  return async () => {
    mlProcess?.kill();
  };
}
