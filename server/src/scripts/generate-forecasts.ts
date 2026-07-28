/**
 * Bulk-generates real forecast rows for 2024-2026 across every
 * (commodity, market) pair that actually has real historical Wholesale
 * data (420 pairs as of the 2015-2023 cleaned dataset — see
 * data/reports/CLEANING_CHANGELOG.md). Never touches existing rows: every
 * (commodity, market, date) combination already present in `predictions`
 * is skipped, so this is safe to re-run and never overwrites or
 * regenerates anything that's already there.
 *
 * Run: cd server && npx tsx src/scripts/generate-forecasts.ts
 * Requires ml/ (port 8000 by default) to be running.
 */
import { pool } from "../db/pool";
import { buildForecast } from "../lib/forecast-pipeline";

const YEARS = [2024, 2025, 2026];
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const CONCURRENCY = 8;

type Pair = { commodityId: string; commodityName: string; category: string; marketId: string; marketName: string };

async function loadRealPairs(): Promise<Pair[]> {
  const { rows } = await pool.query<Pair>(`
    SELECT DISTINCT
      c.id AS "commodityId", c.name AS "commodityName", c.category,
      m.id AS "marketId", m.name AS "marketName"
    FROM prices p
    JOIN commodities c ON c.id = p.commodity_id
    JOIN markets m ON m.id = p.market_id
    WHERE p.price_type = 'Wholesale'
    ORDER BY c.name, m.name
  `);
  return rows;
}

async function loadExistingDates(): Promise<Set<string>> {
  const { rows } = await pool.query<{ key: string }>(`
    SELECT commodity_id || '|' || market_id || '|' || to_char(prediction_date, 'YYYY-MM-DD') AS key
    FROM predictions
  `);
  return new Set(rows.map((r) => r.key));
}

async function generateOne(pair: Pair, month: number, year: number): Promise<void> {
  const forecast = await buildForecast(pair.commodityId, pair.commodityName, pair.marketName, pair.category, month, year);
  const predictionDate = `${year}-${String(month).padStart(2, "0")}-15`;

  const { rows } = await pool.query<{ id: string }>(
    `
    INSERT INTO predictions (commodity_id, market_id, prediction_date, predicted_price, model_name)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id
    `,
    [pair.commodityId, pair.marketId, predictionDate, forecast.baselinePrice, forecast.baselineModelName],
  );

  await pool.query(
    `
    INSERT INTO forecast_runs (
      prediction_id, commodity_id, market_id, forecast_date,
      baseline_price, central_estimate, low_estimate, high_estimate,
      confidence_label, category_mape, signals
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `,
    [
      rows[0].id,
      pair.commodityId,
      pair.marketId,
      predictionDate,
      forecast.baselinePrice,
      forecast.centralEstimate,
      forecast.lowEstimate,
      forecast.highEstimate,
      forecast.confidenceLabel,
      forecast.categoryMape ?? null,
      JSON.stringify({
        signals: forecast.signals,
        why: forecast.why,
        dataFreshness: forecast.dataFreshness,
        extrapolationYears: forecast.extrapolationYears,
        source: "bulk-generate-forecasts",
      }),
    ],
  );
}

async function runWithConcurrency<T>(items: T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
  let cursor = 0;
  async function next(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor++;
      await worker(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, next));
}

async function main(): Promise<void> {
  const pairs = await loadRealPairs();
  const existing = await loadExistingDates();
  console.log(`Found ${pairs.length} real (commodity, market) pairs with Wholesale history.`);

  const jobs: Array<{ pair: Pair; month: number; year: number }> = [];
  for (const pair of pairs) {
    for (const year of YEARS) {
      for (const month of MONTHS) {
        const key = `${pair.commodityId}|${pair.marketId}|${year}-${String(month).padStart(2, "0")}-15`;
        if (!existing.has(key)) jobs.push({ pair, month, year });
      }
    }
  }
  console.log(`${jobs.length} forecast rows to generate (${pairs.length * YEARS.length * MONTHS.length - jobs.length} already exist and will be left untouched).`);

  let done = 0;
  let failed = 0;
  const startedAt = Date.now();

  await runWithConcurrency(jobs, CONCURRENCY, async (job) => {
    try {
      await generateOne(job.pair, job.month, job.year);
    } catch (err) {
      failed += 1;
      console.error(`Failed: ${job.pair.commodityName} @ ${job.pair.marketName} ${job.year}-${job.month}:`, (err as Error).message);
    }
    done += 1;
    if (done % 200 === 0 || done === jobs.length) {
      const elapsedS = (Date.now() - startedAt) / 1000;
      console.log(`${done}/${jobs.length} (${failed} failed) — ${elapsedS.toFixed(0)}s elapsed, ${(done / elapsedS).toFixed(1)}/s`);
    }
  });

  console.log(`Done. Generated ${done - failed} forecasts, ${failed} failed.`);
}

main()
  .then(() => pool.end())
  .catch((err) => {
    console.error(err);
    return pool.end().finally(() => process.exit(1));
  });
