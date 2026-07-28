/**
 * Real USD/GHS exchange rate signal for the forecast pipeline (see
 * forecast-pipeline.ts). Two real, live-queryable sources, not one static
 * number:
 *
 * - CURRENT rate: fawazahmed0/currency-api (free, no key, updated daily).
 * - BASELINE rate: the World Bank's official WDI indicator PA.NUS.FCRF
 *   ("Official exchange rate, LCU per US$, period average") for Ghana,
 *   2023 — a real, citable, authoritative figure. This is deliberately the
 *   *2023 annual average*, not a July-specific daily rate: the currency-api's
 *   historical endpoint only retains a rolling ~17-month window (verified by
 *   probing it — every date before roughly March 2024 404s), so no free,
 *   live-queryable source for a precise 2023-07-15 daily rate exists. Using
 *   the annual average is honest about that — it's a real World Bank number,
 *   just a coarser one than "the exact day the local dataset ends."
 */

export type FxSignal = {
  currentRate: number;
  currentRateDate: string;
  baselineRate: number;
  baselineLabel: string;
  /** Positive = cedi has depreciated against the dollar since the baseline (imports/FX-exposed prices tend to rise). */
  cumulativeChangePct: number;
  fetchedAt: string;
};

const BASELINE_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30d — a historical annual figure never changes; refetch only occasionally in case of data revisions.
const CURRENT_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h

let baselineCache: { rate: number; label: string; fetchedAt: number } | null = null;
let currentCache: { rate: number; date: string; fetchedAt: number } | null = null;

async function fetchBaselineRate(): Promise<{ rate: number; label: string } | undefined> {
  try {
    const response = await fetch(
      "https://api.worldbank.org/v2/country/GH/indicator/PA.NUS.FCRF?format=json&date=2023&per_page=5",
    );
    if (!response.ok) return undefined;
    const body = (await response.json()) as [unknown, Array<{ value: number | null; date: string }> | null];
    const entry = body[1]?.[0];
    if (!entry || typeof entry.value !== "number") return undefined;
    return { rate: entry.value, label: `${entry.date} annual average (World Bank official)` };
  } catch {
    return undefined;
  }
}

async function fetchCurrentRate(): Promise<{ rate: number; date: string } | undefined> {
  try {
    const response = await fetch("https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json");
    if (!response.ok) return undefined;
    const body = (await response.json()) as { date: string; usd?: Record<string, number> };
    const rate = body.usd?.ghs;
    if (typeof rate !== "number") return undefined;
    return { rate, date: body.date };
  } catch {
    return undefined;
  }
}

/**
 * Returns the FX signal, or undefined if BOTH the live rate and any cached
 * fallback are unavailable — callers must treat undefined as "this signal
 * is genuinely unavailable right now" (per the pipeline's explicit fallback
 * rule), not silently substitute a guess.
 */
export async function getFxSignal(): Promise<FxSignal | undefined> {
  if (!baselineCache || Date.now() - baselineCache.fetchedAt > BASELINE_CACHE_TTL_MS) {
    const fetched = await fetchBaselineRate();
    if (fetched) baselineCache = { ...fetched, fetchedAt: Date.now() };
  }
  if (!currentCache || Date.now() - currentCache.fetchedAt > CURRENT_CACHE_TTL_MS) {
    const fetched = await fetchCurrentRate();
    if (fetched) currentCache = { ...fetched, fetchedAt: Date.now() };
  }

  if (!baselineCache || !currentCache) return undefined;

  const cumulativeChangePct = ((currentCache.rate - baselineCache.rate) / baselineCache.rate) * 100;

  return {
    currentRate: currentCache.rate,
    currentRateDate: currentCache.date,
    baselineRate: baselineCache.rate,
    baselineLabel: baselineCache.label,
    cumulativeChangePct,
    fetchedAt: new Date(currentCache.fetchedAt).toISOString(),
  };
}
