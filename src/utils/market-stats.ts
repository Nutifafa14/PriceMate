import type { Commodity, PricePoint } from "@/types";

export type PriceLevel = "low" | "average" | "high";

export type MarketPriceStats = {
  level: PriceLevel;
  /** 1.0 = exactly the national average; 1.15 = 15% above it. */
  ratioToNational: number;
  /** How consistently the market's prices track the national average across commodities — a real statistic (stddev of per-commodity ratios), not a time-series volatility measure. */
  consistency: number;
  commodityCount: number;
};

/** National average latest-Wholesale price per commodity, across all markets that report one. */
function nationalAverages(latestPrices: PricePoint[]): Map<string, number> {
  const sums = new Map<string, { total: number; count: number }>();
  for (const p of latestPrices) {
    if (p.priceType !== "Wholesale") continue;
    const entry = sums.get(p.commodityId) ?? { total: 0, count: 0 };
    entry.total += p.price;
    entry.count += 1;
    sums.set(p.commodityId, entry);
  }
  const result = new Map<string, number>();
  for (const [id, { total, count }] of sums) result.set(id, total / count);
  return result;
}

const LOW_THRESHOLD = 0.9;
const HIGH_THRESHOLD = 1.1;

/**
 * A market's wholesale price level relative to the true national average,
 * computed per-commodity then averaged — this avoids the bias of a naive
 * "average this market's prices" comparison, which would unfairly flag a
 * market that happens to trade more yam (expensive) as "high" against one
 * that trades more tomatoes (cheap), even if both are priced fairly
 * relative to what each commodity actually costs nationally.
 *
 * Returns undefined for markets with no Wholesale price history (e.g. the
 * MoFA-only named markets) — their community-reported prices have no
 * documented unit and are never blended into this comparison; an honest
 * "no index available" is correct here, not a fabricated one.
 */
export function computeMarketPriceStats(
  latestPrices: PricePoint[],
  marketId: string,
): MarketPriceStats | undefined {
  const national = nationalAverages(latestPrices);
  const ratios: number[] = [];
  for (const p of latestPrices) {
    if (p.priceType !== "Wholesale" || p.marketId !== marketId) continue;
    const nationalAvg = national.get(p.commodityId);
    if (nationalAvg && nationalAvg > 0) ratios.push(p.price / nationalAvg);
  }
  if (ratios.length === 0) return undefined;

  const mean = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  const variance = ratios.reduce((sum, r) => sum + (r - mean) ** 2, 0) / ratios.length;
  const level: PriceLevel = mean < LOW_THRESHOLD ? "low" : mean > HIGH_THRESHOLD ? "high" : "average";

  return { level, ratioToNational: mean, consistency: Math.sqrt(variance), commodityCount: ratios.length };
}

export const PRICE_LEVEL_LABEL: Record<PriceLevel, string> = {
  low: "Low prices",
  average: "Average prices",
  high: "High prices",
};

export const PRICE_LEVEL_TONE: Record<PriceLevel, "success" | "neutral" | "danger"> = {
  low: "success",
  average: "neutral",
  high: "danger",
};

/** A plain-language label for `MarketPriceStats.consistency` (stddev of per-commodity price ratios vs national average). */
export function consistencyLabel(consistency: number): string {
  if (consistency < 0.15) return "Consistent";
  if (consistency < 0.3) return "Somewhat variable";
  return "Highly variable";
}

/** Commodity names with a recent Wholesale price at this market, most recent first — real data, used for "Popular Commodities" tags. */
export function getMarketCommodityNames(
  latestPrices: PricePoint[],
  marketId: string,
  commodityById: Map<string, Commodity>,
  limit = 3,
): string[] {
  const entries = latestPrices
    .filter((p) => p.priceType === "Wholesale" && p.marketId === marketId)
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  const seen = new Set<string>();
  const names: string[] = [];
  for (const p of entries) {
    const commodity = commodityById.get(p.commodityId);
    if (!commodity || seen.has(commodity.id)) continue;
    seen.add(commodity.id);
    names.push(commodity.name);
    if (names.length >= limit) break;
  }
  return names;
}
