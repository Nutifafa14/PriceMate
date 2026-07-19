import type { CommunityPricePoint, PricePoint } from "@/types";

/**
 * Picks the most-recently-dated Wholesale price from a list of price
 * points. Used both to pick one "current price" for a single commodity
 * (Commodity/Market Detail) and, grouped per commodityId, to pick one
 * representative market per commodity for grid views (Home, Favourites) —
 * see groupLatestWholesaleByCommodity below. "Most recent" is the
 * deterministic tie-breaker across markets that all carry the same
 * commodity.
 */
export function pickMostRecentWholesale(prices: PricePoint[]): PricePoint | undefined {
  let best: PricePoint | undefined;
  for (const p of prices) {
    if (p.priceType !== "Wholesale") continue;
    if (!best || p.date > best.date) best = p;
  }
  return best;
}

/** Groups a `/prices/latest` response (no filters) into one representative Wholesale price per commodityId. */
export function groupLatestWholesaleByCommodity(prices: PricePoint[]): Map<string, PricePoint> {
  const byCommodity = new Map<string, PricePoint[]>();
  for (const p of prices) {
    const list = byCommodity.get(p.commodityId) ?? [];
    list.push(p);
    byCommodity.set(p.commodityId, list);
  }

  const result = new Map<string, PricePoint>();
  for (const [commodityId, points] of byCommodity) {
    const best = pickMostRecentWholesale(points);
    if (best) result.set(commodityId, best);
  }
  return result;
}

/**
 * Groups a `/community-prices` response into one most-recently-dated report
 * per commodityId — unlike groupLatestWholesaleByCommodity, both Wholesale
 * and Retail rows are eligible (MoFA reports both, and there's no separate
 * "wholesale trend" concept for this data — see CommunityPricePoint's doc
 * comment). Callers must still show `priceType` and `source` per row.
 */
export function groupLatestCommunityByCommodity(
  prices: CommunityPricePoint[],
): Map<string, CommunityPricePoint> {
  const result = new Map<string, CommunityPricePoint>();
  for (const p of prices) {
    const current = result.get(p.commodityId);
    if (!current || p.date > current.date) result.set(p.commodityId, p);
  }
  return result;
}
