import { pool } from "../db/pool";

/**
 * Real statistical outlier detection over the actual historical `prices`
 * table — a z-score against the series' own mean/stddev, computed live from
 * real recorded prices (not simulated, not a model output). A commodity's
 * price series is grouped by market before scoring: pooling across markets
 * first would inflate the stddev with real cross-market price-level
 * differences and mask genuine anomalies within any one market's own trend.
 */

export type PriceAnomaly = {
  id: string;
  marketId: string;
  marketName: string;
  date: string;
  price: number;
  zScore: number;
  seriesMean: number;
  seriesStdDev: number;
};

const Z_SCORE_THRESHOLD = 2.5;
const MIN_SERIES_LENGTH = 8; // below this, a mean/stddev isn't stable enough to call anything an "anomaly."

type Row = { id: string; marketId: string; marketName: string; date: string; price: number };

export async function detectPriceAnomalies(
  commodityId: string,
  marketId?: string,
): Promise<{ anomalies: PriceAnomaly[]; seriesScanned: number; pointsScanned: number }> {
  const params: unknown[] = [commodityId];
  let marketFilter = "";
  if (marketId) {
    params.push(marketId);
    marketFilter = `AND p.market_id = $${params.length}`;
  }

  const { rows } = await pool.query<Row>(
    `
    SELECT p.id, p.market_id AS "marketId", m.name AS "marketName", to_char(p.date, 'YYYY-MM-DD') AS date, p.price::float AS price
    FROM prices p
    JOIN markets m ON m.id = p.market_id
    WHERE p.commodity_id = $1 AND p.price_type = 'Wholesale' ${marketFilter}
    ORDER BY p.market_id, p.date
    `,
    params,
  );

  const byMarket = new Map<string, Row[]>();
  for (const row of rows) {
    const list = byMarket.get(row.marketId) ?? [];
    list.push(row);
    byMarket.set(row.marketId, list);
  }

  const anomalies: PriceAnomaly[] = [];
  let seriesScanned = 0;

  for (const series of byMarket.values()) {
    if (series.length < MIN_SERIES_LENGTH) continue;
    seriesScanned += 1;

    const mean = series.reduce((sum, r) => sum + r.price, 0) / series.length;
    const variance = series.reduce((sum, r) => sum + (r.price - mean) ** 2, 0) / series.length;
    const stdDev = Math.sqrt(variance);
    if (stdDev === 0) continue;

    for (const r of series) {
      const zScore = (r.price - mean) / stdDev;
      if (Math.abs(zScore) >= Z_SCORE_THRESHOLD) {
        anomalies.push({
          id: r.id,
          marketId: r.marketId,
          marketName: r.marketName,
          date: r.date,
          price: r.price,
          zScore: Math.round(zScore * 100) / 100,
          seriesMean: Math.round(mean * 100) / 100,
          seriesStdDev: Math.round(stdDev * 100) / 100,
        });
      }
    }
  }

  anomalies.sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore));

  return { anomalies, seriesScanned, pointsScanned: rows.length };
}
