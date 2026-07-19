import { describe, expect, it } from "vitest";

import { pool } from "../src/db/pool";
import { importCommunityPrices } from "../src/seed/import-community-prices";
import { importCsv } from "../src/seed/import-csv";

// The suite's global setup (tests/global-setup.ts) already ran this import
// pipeline once against the real cleaned CSV before any test file executed.
// These assertions confirm that run produced exactly the counts the dataset
// is known to have (see data/reports/CLEANING_CHANGELOG.md), and that
// running it again is a true no-op.
describe("CSV import/seed pipeline", () => {
  it("seeded the exact row counts from the cleaned dataset", async () => {
    const [markets, commodities, prices] = await Promise.all([
      pool.query("SELECT count(*)::int AS count FROM markets"),
      pool.query("SELECT count(*)::int AS count FROM commodities"),
      pool.query("SELECT count(*)::int AS count FROM prices"),
    ]);

    // 20 WFP-derived markets + 10 new named markets introduced by the MoFA
    // community-prices import (see data/reports/MOFA_CLEANING_CHANGELOG.md).
    expect(markets.rows[0].count).toBe(30);
    expect(commodities.rows[0].count).toBe(26);
    expect(prices.rows[0].count).toBe(8543);
  });

  it("is idempotent when re-run against an already-seeded database", async () => {
    const summary = await importCsv(pool);
    expect(summary.rowsRead).toBe(8543);
    expect(summary.rowsRejected).toBe(0);
    expect(summary.pricesInserted).toBe(0);
    expect(summary.markets).toBe(20);
    expect(summary.commodities).toBe(26);
  });
});

// See data/reports/MOFA_CLEANING_CHANGELOG.md for why this is a separate
// table/pipeline from the WFP-derived prices above: MoFA's source has no
// documented unit, so it's never blended into `prices` or the ML model.
describe("Community price import/seed pipeline (MoFA SRID)", () => {
  it("seeded the exact row count from the cleaned MoFA dataset", async () => {
    const communityPrices = await pool.query("SELECT count(*)::int AS count FROM community_prices");
    expect(communityPrices.rows[0].count).toBe(5143);
  });

  it("is idempotent when re-run against an already-seeded database", async () => {
    const summary = await importCommunityPrices(pool);
    expect(summary.rowsRead).toBe(5143);
    expect(summary.rowsRejected).toBe(0);
    expect(summary.pricesInserted).toBe(0);
    expect(summary.newMarkets).toBe(0);
  });
});
