import fs from "node:fs";
import path from "node:path";

import { parse } from "csv-parse/sync";
import type { Pool } from "pg";

import { csvRowSchema, type CsvRow } from "../schemas/csv-row";

export const CSV_PATH = path.join(__dirname, "..", "..", "..", "data", "ghana_food_prices_clean.csv");

export type ImportSummary = {
  rowsRead: number;
  rowsRejected: number;
  markets: number;
  commodities: number;
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
 * Idempotent: markets/commodities are upserted by their unique name, and
 * prices use ON CONFLICT DO NOTHING on the same composite key the migration
 * enforces, so re-running this against an already-seeded database is safe.
 */
export async function importCsv(db: Pool, csvPath: string = CSV_PATH): Promise<ImportSummary> {
  const raw = fs.readFileSync(csvPath, "utf-8");
  const records: Record<string, string>[] = parse(raw, { columns: true, skip_empty_lines: true });

  const validRows: CsvRow[] = [];
  const rejections: ImportSummary["rejections"] = [];

  records.forEach((record, index) => {
    const result = csvRowSchema.safeParse(record);
    if (result.success) {
      validRows.push(result.data);
    } else {
      rejections.push({ row: index + 2, issues: result.error.issues.map((i) => i.message).join("; ") });
    }
  });

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const marketByName = new Map<
      string,
      { region: string; district: string; latitude: number; longitude: number }
    >();
    const commodityByName = new Map<string, string>();
    for (const row of validRows) {
      if (!marketByName.has(row.market)) {
        marketByName.set(row.market, {
          region: row.region,
          district: row.district,
          latitude: row.latitude,
          longitude: row.longitude,
        });
      }
      if (!commodityByName.has(row.commodity)) {
        commodityByName.set(row.commodity, row.category);
      }
    }

    const marketIdByName = new Map<string, string>();
    for (const [name, m] of marketByName) {
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO markets (name, region, district, latitude, longitude)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (name) DO UPDATE SET region = EXCLUDED.region, district = EXCLUDED.district,
           latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude
         RETURNING id`,
        [name, m.region, m.district, m.latitude, m.longitude],
      );
      marketIdByName.set(name, rows[0].id);
    }

    const commodityIdByName = new Map<string, string>();
    for (const [name, category] of commodityByName) {
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO commodities (name, category)
         VALUES ($1, $2)
         ON CONFLICT (name) DO UPDATE SET category = EXCLUDED.category
         RETURNING id`,
        [name, category],
      );
      commodityIdByName.set(name, rows[0].id);
    }

    let pricesInserted = 0;
    for (const batch of chunk(validRows, CHUNK_SIZE)) {
      const values: unknown[] = [];
      const placeholders = batch.map((row, i) => {
        const base = i * 9;
        values.push(
          commodityIdByName.get(row.commodity),
          marketIdByName.get(row.market),
          row.date,
          row.price,
          row.price_type,
          row.currency,
          row.unit,
          row.unit_quantity,
          row.unit_measure,
        );
        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9})`;
      });

      const result = await client.query(
        `INSERT INTO prices (commodity_id, market_id, date, price, price_type, currency, unit, unit_quantity, unit_measure)
         VALUES ${placeholders.join(", ")}
         ON CONFLICT (commodity_id, market_id, date, price_type, unit) DO NOTHING`,
        values,
      );
      pricesInserted += result.rowCount ?? 0;
    }

    await client.query("COMMIT");

    return {
      rowsRead: records.length,
      rowsRejected: rejections.length,
      markets: marketIdByName.size,
      commodities: commodityIdByName.size,
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
