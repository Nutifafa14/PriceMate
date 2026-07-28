import { pool } from "../db/pool";

/**
 * A real, historically-observed seasonal pattern for a commodity — how far
 * above/below its own annual average the target month typically runs,
 * computed directly from the real `prices` table (no external API, always
 * available for any commodity with Wholesale history).
 *
 * Deliberately informational only, NOT folded into the central estimate:
 * the ML model's own features already include month_sin/month_cos (see
 * ml/src/data.py), so its baseline prediction already reflects whatever
 * seasonal pattern it learned from training data. Adding a second,
 * separately-computed seasonal adjustment on top would double-count that
 * signal. Instead this is surfaced as disclosed context in the forecast's
 * `why[]` — useful for explaining *why* a month looks the way it does,
 * without silently re-adjusting a number the model already adjusted.
 */

export type SeasonalContext = {
  available: boolean;
  /** This month's real historical average price, as a % deviation from the commodity's own annual average across all months (e.g. +12.4 = historically 12.4% above average). */
  deviationPct: number;
  monthsOfData: number;
  detail: string;
};

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h — this is a slow-moving historical pattern computed from a fixed 2015-2023 dataset, not a live signal.
const cache = new Map<string, { value: Map<number, number>; fetchedAt: number }>();

async function monthlyIndexForCommodity(commodityId: string): Promise<Map<number, number>> {
  const cached = cache.get(commodityId);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.value;

  const { rows } = await pool.query<{ month: number; avgPrice: number }>(
    `
    SELECT EXTRACT(MONTH FROM date)::int AS month, AVG(price)::float AS "avgPrice"
    FROM prices
    WHERE commodity_id = $1 AND price_type = 'Wholesale'
    GROUP BY month
    `,
    [commodityId],
  );

  const index = new Map<number, number>();
  if (rows.length > 0) {
    const overallAvg = rows.reduce((sum, r) => sum + r.avgPrice, 0) / rows.length;
    for (const r of rows) {
      index.set(r.month, overallAvg > 0 ? ((r.avgPrice - overallAvg) / overallAvg) * 100 : 0);
    }
  }
  cache.set(commodityId, { value: index, fetchedAt: Date.now() });
  return index;
}

export async function getSeasonalContext(
  commodityId: string,
  commodityName: string,
  month: number,
): Promise<SeasonalContext> {
  const index = await monthlyIndexForCommodity(commodityId);
  const deviationPct = index.get(month);

  if (deviationPct === undefined || index.size < 6) {
    return {
      available: false,
      deviationPct: 0,
      monthsOfData: index.size,
      detail: `Not enough historical Wholesale data across calendar months to establish a seasonal pattern for ${commodityName}.`,
    };
  }

  const direction = deviationPct > 3 ? "above" : deviationPct < -3 ? "below" : "close to";
  return {
    available: true,
    deviationPct,
    monthsOfData: index.size,
    detail: `Historically, this month has run ${Math.abs(deviationPct).toFixed(1)}% ${direction} ${commodityName}'s annual average price (computed from real 2015-2023 records). This is informational context — the model's own baseline prediction already accounts for seasonal patterns it learned, so this is not applied as a separate adjustment.`,
  };
}
