import fs from "node:fs";
import path from "node:path";

import { parse } from "csv-parse/sync";
import type { Pool } from "pg";

import { communityPriceRowSchema, type CommunityPriceRow } from "../schemas/community-price-row";

export const COMMUNITY_CSV_PATH = path.join(
  __dirname,
  "..",
  "..",
  "..",
  "data",
  "mofa_community_prices_clean.csv",
);

export type CommunityImportSummary = {
  rowsRead: number;
  rowsRejected: number;
  newMarkets: number;
  pricesInserted: number;
  rejections: Array<{ row: number; issues: string }>;
};

const CHUNK_SIZE = 500;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Idempotent, like import-csv.ts. Markets referenced here are upserted by
 * name (ON CONFLICT DO NOTHING) — most rows attach to a market the main
 * import already created; ~10 are genuinely new named markets this pipeline
 * introduces (see data/reports/MOFA_CLEANING_CHANGELOG.md). Commodities are
 * looked up only, never created — community prices are deliberately
 * restricted to the existing 26-commodity taxonomy, so a row whose
 * commodity isn't already in the DB indicates the main CSV import hasn't
 * run yet, and the row is rejected rather than silently inventing a new
 * commodity here.
 */
export async function importCommunityPrices(
  db: Pool,
  csvPath: string = COMMUNITY_CSV_PATH,
): Promise<CommunityImportSummary> {
  const raw = fs.readFileSync(csvPath, "utf-8");
  const records: Record<string, string>[] = parse(raw, { columns: true, skip_empty_lines: true });

  const validRows: CommunityPriceRow[] = [];
  const rejections: CommunityImportSummary["rejections"] = [];

  records.forEach((record, index) => {
    const result = communityPriceRowSchema.safeParse(record);
    if (result.success) {
      validRows.push(result.data);
    } else {
      rejections.push({ row: index + 2, issues: result.error.issues.map((i) => i.message).join("; ") });
    }
  });

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const marketByName = new Map<string, { region: string; district: string }>();
    for (const row of validRows) {
      if (!marketByName.has(row.market)) {
        marketByName.set(row.market, { region: row.region, district: row.district });
      }
    }

    const marketIdByName = new Map<string, string>();
    let newMarkets = 0;
    for (const [name, m] of marketByName) {
      const { rows } = await client.query<{ id: string; inserted: boolean }>(
        `INSERT INTO markets (name, region, district)
         VALUES ($1, $2, $3)
         ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
         RETURNING id, (xmax = 0) AS inserted`,
        [name, m.region, m.district],
      );
      marketIdByName.set(name, rows[0].id);
      if (rows[0].inserted) newMarkets += 1;
    }

    const commodityNames = [...new Set(validRows.map((r) => r.commodity))];
    const { rows: commodityRows } = await client.query<{ id: string; name: string }>(
      `SELECT id, name FROM commodities WHERE name = ANY($1)`,
      [commodityNames],
    );
    const commodityIdByName = new Map(commodityRows.map((r) => [r.name, r.id]));

    const rowsForInsert = validRows.filter((r) => commodityIdByName.has(r.commodity));
    for (const row of validRows) {
      if (!commodityIdByName.has(row.commodity)) {
        rejections.push({
          row: -1,
          issues: `commodity "${row.commodity}" not found — run the main CSV import first`,
        });
      }
    }

    let pricesInserted = 0;
    for (const batch of chunk(rowsForInsert, CHUNK_SIZE)) {
      const values: unknown[] = [];
      const placeholders = batch.map((row, i) => {
        const base = i * 7;
        values.push(
          commodityIdByName.get(row.commodity),
          marketIdByName.get(row.market),
          row.date,
          row.price,
          row.price_type,
          row.currency,
          row.source,
        );
        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7})`;
      });

      const result = await client.query(
        `INSERT INTO community_prices (commodity_id, market_id, date, price, price_type, currency, source)
         VALUES ${placeholders.join(", ")}
         ON CONFLICT (commodity_id, market_id, date, price_type, source) DO NOTHING`,
        values,
      );
      pricesInserted += result.rowCount ?? 0;
    }

    await client.query("COMMIT");

    return {
      rowsRead: records.length,
      rowsRejected: rejections.length,
      newMarkets,
      pricesInserted,
      rejections,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
