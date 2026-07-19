import { pool } from "../db/pool";
import { runMigrations } from "../db/migrate";
import { importCommunityPrices } from "./import-community-prices";
import { importCsv } from "./import-csv";

async function main(): Promise<void> {
  const applied = await runMigrations(pool);
  if (applied.length) {
    console.log(`Applied ${applied.length} migration(s): ${applied.join(", ")}`);
  }

  const summary = await importCsv(pool);
  console.log(`Read ${summary.rowsRead} CSV rows (${summary.rowsRejected} rejected).`);
  console.log(`Upserted ${summary.markets} markets, ${summary.commodities} commodities.`);
  console.log(`Inserted ${summary.pricesInserted} new price rows (existing rows left untouched).`);

  if (summary.rejections.length) {
    console.warn("Rejected rows:");
    for (const r of summary.rejections.slice(0, 20)) {
      console.warn(`  row ${r.row}: ${r.issues}`);
    }
  }

  const communitySummary = await importCommunityPrices(pool);
  console.log(
    `Read ${communitySummary.rowsRead} community price rows (${communitySummary.rowsRejected} rejected).`,
  );
  console.log(`Introduced ${communitySummary.newMarkets} new named markets.`);
  console.log(`Inserted ${communitySummary.pricesInserted} new community price rows.`);

  if (communitySummary.rejections.length) {
    console.warn("Rejected community price rows:");
    for (const r of communitySummary.rejections.slice(0, 20)) {
      console.warn(`  row ${r.row}: ${r.issues}`);
    }
  }
}

main()
  .then(() => pool.end())
  .catch((err) => {
    console.error(err);
    return pool.end().finally(() => process.exit(1));
  });
