import { pool } from "../db/pool";

/**
 * Shopping Basket Optimiser — given a list of (commodity, quantity) pairs,
 * finds the cheapest way to buy everything using real, current Wholesale
 * prices, and estimates whether spreading the trip across multiple markets
 * is actually worth it once a real transport cost is factored in.
 *
 * Unit honesty: this dataset's `unit_measure` is not consistent per
 * commodity — a market may sell Maize in 50kg or 100kg bags (see
 * data/reports/CLEANING_CHANGELOG.md). For any commodity measured in KG,
 * prices are normalized to price-per-kg (price / unit_quantity) before
 * comparison, so a 50kg bag and a 100kg bag are compared fairly and
 * `quantity` means real kilograms. For non-weight units (Bunch, pcs,
 * Tubers), there is no safe conversion, so only markets selling the exact
 * same unit are compared, and `quantity` means "that many of that unit."
 * Markets that can't be honestly compared are excluded and listed, not
 * silently guessed at.
 *
 * Transport cost is a disclosed, flat estimate — GHS 6 per market beyond
 * the first (a typical local shared-transport fare), not a real
 * GPS/routing distance calculation, since the app has no user location or
 * routing data. This is stated explicitly in the response, not presented
 * as precise.
 */

export const TRANSPORT_COST_PER_EXTRA_MARKET = 6;
const MAX_MARKETS_FOR_COMBINATION = 4;
// A cheaper multi-market plan only gets recommended over the simple
// single-market plan if it saves at least this much — otherwise the extra
// travel/hassle of a multi-stop trip isn't worth a trivial saving.
const SIGNIFICANT_SAVINGS_ABSOLUTE = 10;
const SIGNIFICANT_SAVINGS_FRACTION = 0.05;

export type BasketItemInput = { commodityId: string; quantity: number };

type MarketOption = {
  marketId: string;
  marketName: string;
  pricePerUnit: number;
  rawPrice: number;
  rawUnit: string;
  date: string;
};

export type ItemPricing = {
  commodityId: string;
  commodityName: string;
  quantity: number;
  unitLabel: string; // "kg" for weight-normalized commodities, else the raw unit string
  options: MarketOption[]; // sorted cheapest-per-unit first
  excludedMarkets: { marketId: string; marketName: string; reason: string }[];
};

export type MarketPlan = {
  marketIds: string[];
  marketNames: string[];
  itemTotal: number;
  transportCost: number;
  netCost: number;
  perItem: { commodityId: string; commodityName: string; marketId: string; marketName: string; lineCost: number }[];
};

export type BasketOptimizationResult = {
  items: ItemPricing[];
  unpriceableItems: { commodityId: string; commodityName: string }[];
  cheapestPerItem: MarketPlan | undefined;
  cheapestSingleMarket: MarketPlan | undefined;
  bestCombination: MarketPlan | undefined;
  recommendation: {
    plan: "singleMarket" | "combination" | "perItem" | "none";
    reasoning: string;
  };
  transportCostPerExtraMarket: number;
};

type PriceRow = {
  marketId: string;
  marketName: string;
  price: number;
  unit: string;
  unitQuantity: number;
  unitMeasure: string;
  date: string;
};

async function fetchLatestPricesAcrossMarkets(commodityId: string): Promise<PriceRow[]> {
  const { rows } = await pool.query<PriceRow>(
    `
    SELECT DISTINCT ON (p.market_id)
      p.market_id AS "marketId", m.name AS "marketName", p.price::float AS price,
      p.unit, p.unit_quantity::float AS "unitQuantity", p.unit_measure AS "unitMeasure",
      to_char(p.date, 'YYYY-MM-DD') AS date
    FROM prices p
    JOIN markets m ON m.id = p.market_id
    WHERE p.commodity_id = $1 AND p.price_type = 'Wholesale'
    ORDER BY p.market_id, p.date DESC
    `,
    [commodityId],
  );
  return rows;
}

function buildItemPricing(commodityId: string, commodityName: string, quantity: number, rows: PriceRow[]): ItemPricing {
  const excludedMarkets: ItemPricing["excludedMarkets"] = [];

  const weightRows = rows.filter((r) => r.unitMeasure.toUpperCase() === "KG");
  const nonWeightRows = rows.filter((r) => r.unitMeasure.toUpperCase() !== "KG");

  let comparableRows: PriceRow[];
  let unitLabel: string;

  if (weightRows.length > 0) {
    comparableRows = weightRows;
    unitLabel = "kg";
    for (const r of nonWeightRows) {
      excludedMarkets.push({
        marketId: r.marketId,
        marketName: r.marketName,
        reason: `Priced by ${r.unit}, not weight — not safely comparable to the per-kg price used for other markets.`,
      });
    }
  } else {
    // No KG-measured market for this commodity — fall back to comparing
    // only markets that share the exact same unit as the most common one.
    const unitCounts = new Map<string, number>();
    for (const r of nonWeightRows) unitCounts.set(r.unit, (unitCounts.get(r.unit) ?? 0) + 1);
    const referenceUnit = [...unitCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    comparableRows = nonWeightRows.filter((r) => r.unit === referenceUnit);
    unitLabel = comparableRows[0]?.unitMeasure.toLowerCase() ?? "unit";
    for (const r of nonWeightRows) {
      if (r.unit !== referenceUnit) {
        excludedMarkets.push({
          marketId: r.marketId,
          marketName: r.marketName,
          reason: `Priced by ${r.unit}, not directly comparable to the ${referenceUnit} used for other markets.`,
        });
      }
    }
  }

  // Always normalize by unit_quantity: for KG rows this yields price-per-kg;
  // for same-unit non-KG rows (e.g. all "30 pcs") it yields price-per-single-
  // piece, which is a finer, more honest unit for `quantity` to mean than
  // "number of 30-packs" — and since every row in this branch shares the
  // same unit_quantity, it doesn't change their relative ranking either way.
  const options: MarketOption[] = comparableRows
    .map((r) => ({
      marketId: r.marketId,
      marketName: r.marketName,
      pricePerUnit: r.price / r.unitQuantity,
      rawPrice: r.price,
      rawUnit: r.unit,
      date: r.date,
    }))
    .sort((a, b) => a.pricePerUnit - b.pricePerUnit);

  return { commodityId, commodityName, quantity, unitLabel, options, excludedMarkets };
}

function planFromAssignment(
  items: ItemPricing[],
  assignment: Map<string, MarketOption>, // commodityId -> chosen market option
): MarketPlan {
  const perItem = items.map((item) => {
    const option = assignment.get(item.commodityId)!;
    return {
      commodityId: item.commodityId,
      commodityName: item.commodityName,
      marketId: option.marketId,
      marketName: option.marketName,
      lineCost: Math.round(option.pricePerUnit * item.quantity * 100) / 100,
    };
  });
  const itemTotal = Math.round(perItem.reduce((sum, l) => sum + l.lineCost, 0) * 100) / 100;
  const marketIds = [...new Set(perItem.map((l) => l.marketId))];
  const marketNames = [...new Set(perItem.map((l) => l.marketName))];
  const transportCost = (marketIds.length - 1) * TRANSPORT_COST_PER_EXTRA_MARKET;
  return { marketIds, marketNames, itemTotal, transportCost, netCost: Math.round((itemTotal + transportCost) * 100) / 100, perItem };
}

function cheapestPerItemPlan(items: ItemPricing[]): MarketPlan | undefined {
  if (items.some((i) => i.options.length === 0)) return undefined;
  const assignment = new Map<string, MarketOption>();
  for (const item of items) assignment.set(item.commodityId, item.options[0]);
  return planFromAssignment(items, assignment);
}

function cheapestSingleMarketPlan(items: ItemPricing[]): MarketPlan | undefined {
  const marketIdSets = items.map((i) => new Set(i.options.map((o) => o.marketId)));
  if (marketIdSets.length === 0) return undefined;
  const commonMarketIds = [...marketIdSets[0]].filter((id) => marketIdSets.every((s) => s.has(id)));
  if (commonMarketIds.length === 0) return undefined;

  let best: MarketPlan | undefined;
  for (const marketId of commonMarketIds) {
    const assignment = new Map<string, MarketOption>();
    for (const item of items) assignment.set(item.commodityId, item.options.find((o) => o.marketId === marketId)!);
    const plan = planFromAssignment(items, assignment);
    if (!best || plan.netCost < best.netCost) best = plan;
  }
  return best;
}

function combinations<T>(arr: T[], size: number): T[][] {
  if (size === 0) return [[]];
  if (arr.length < size) return [];
  const [first, ...rest] = arr;
  const withFirst = combinations(rest, size - 1).map((c) => [first, ...c]);
  const withoutFirst = combinations(rest, size);
  return [...withFirst, ...withoutFirst];
}

function bestCombinationPlan(items: ItemPricing[]): MarketPlan | undefined {
  if (items.some((i) => i.options.length === 0)) return undefined;

  // Candidate markets: every market that's the cheapest option for at
  // least one item — the only markets that could ever plausibly appear in
  // an optimal combination. Keeps the search space small and real.
  const candidateIds = [...new Set(items.map((i) => i.options[0].marketId))];

  let best: MarketPlan | undefined;
  for (let size = 1; size <= Math.min(MAX_MARKETS_FOR_COMBINATION, candidateIds.length); size++) {
    for (const subset of combinations(candidateIds, size)) {
      const subsetSet = new Set(subset);
      const assignment = new Map<string, MarketOption>();
      let coversAll = true;
      for (const item of items) {
        const cheapestInSubset = item.options.find((o) => subsetSet.has(o.marketId));
        if (!cheapestInSubset) {
          coversAll = false;
          break;
        }
        assignment.set(item.commodityId, cheapestInSubset);
      }
      if (!coversAll) continue;
      const plan = planFromAssignment(items, assignment);
      if (!best || plan.netCost < best.netCost) best = plan;
    }
  }
  return best;
}

export async function optimizeBasket(basketItems: BasketItemInput[]): Promise<BasketOptimizationResult> {
  const commodityRows = await pool.query<{ id: string; name: string }>(
    `SELECT id, name FROM commodities WHERE id = ANY($1)`,
    [basketItems.map((i) => i.commodityId)],
  );
  const nameById = new Map(commodityRows.rows.map((r) => [r.id, r.name]));

  const pricingResults = await Promise.all(
    basketItems.map(async (input) => {
      const name = nameById.get(input.commodityId) ?? "Unknown commodity";
      const rows = await fetchLatestPricesAcrossMarkets(input.commodityId);
      return buildItemPricing(input.commodityId, name, input.quantity, rows);
    }),
  );

  const items = pricingResults.filter((p) => p.options.length > 0);
  const unpriceableItems = pricingResults
    .filter((p) => p.options.length === 0)
    .map((p) => ({ commodityId: p.commodityId, commodityName: p.commodityName }));

  const cheapestPerItem = cheapestPerItemPlan(items);
  const cheapestSingleMarket = cheapestSingleMarketPlan(items);
  const bestCombination = bestCombinationPlan(items);

  let plan: BasketOptimizationResult["recommendation"]["plan"] = "none";
  let reasoning = "Not enough priced items to make a recommendation.";

  if (cheapestSingleMarket && bestCombination) {
    const savings = cheapestSingleMarket.netCost - bestCombination.netCost;
    const threshold = Math.max(SIGNIFICANT_SAVINGS_ABSOLUTE, cheapestSingleMarket.netCost * SIGNIFICANT_SAVINGS_FRACTION);
    if (bestCombination.marketIds.length > 1 && savings > threshold) {
      plan = "combination";
      reasoning = `Splitting this trip across ${bestCombination.marketIds.length} markets saves GHS ${savings.toFixed(2)} net of estimated transport — enough to be worth the extra stops.`;
    } else {
      plan = "singleMarket";
      reasoning =
        savings > 0
          ? `A multi-market trip is only GHS ${savings.toFixed(2)} cheaper net of transport — not enough to be worth the extra stops, so buying everything from ${cheapestSingleMarket.marketNames[0]} is recommended.`
          : `${cheapestSingleMarket.marketNames[0]} already has the lowest net cost for everything in this basket.`;
    }
  } else if (cheapestSingleMarket) {
    plan = "singleMarket";
    reasoning = `${cheapestSingleMarket.marketNames[0]} is the only market with every item in this basket.`;
  } else if (cheapestPerItem) {
    plan = "perItem";
    reasoning = "No single market carries every item, and no small combination covers the whole basket — buying each item from its own cheapest market is the only complete option found.";
  }

  return {
    items,
    unpriceableItems,
    cheapestPerItem,
    cheapestSingleMarket,
    bestCombination,
    recommendation: { plan, reasoning },
    transportCostPerExtraMarket: TRANSPORT_COST_PER_EXTRA_MARKET,
  };
}
