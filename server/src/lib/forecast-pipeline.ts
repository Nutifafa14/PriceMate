import { getFxSignal, type FxSignal } from "./fx-client";
import { getGlobalBenchmarkSignal, type GlobalBenchmarkSignal } from "./global-benchmark-client";
import { getMlMetadata, predictPrice } from "./ml-client";
import { getNewsSignal, type NewsSignal } from "./news-signal";
import { getSeasonalContext } from "./seasonal-signal";

/**
 * Combines the Phase 4 ML model (a real statistical baseline, trained only
 * on data through 2023-07) with real, live signals the model has never
 * seen, into a disclosed range + confidence — never a bare point estimate.
 *
 * Every commodity in this app is either locally grown/consumed (no
 * international futures market exists for it) or, for Maize/Rice, loosely
 * linked to one via trade. So "signal adjustment" here is NOT a second
 * model — it's a small set of manually-set, fully disclosed pass-through
 * coefficients estimating how much of a real macro move (FX depreciation,
 * a world price swing, current news pressure) plausibly reaches a Ghanaian
 * market stall, on top of whatever the seasonal/historical pattern the ML
 * model already captures. These coefficients are informed judgment, not
 * fitted or backtested — that is stated explicitly in every forecast's
 * `why` output, not hidden.
 *
 * News is deliberately NOT a retrained model feature (see news-signal.ts):
 * GNews's free tier has no historical article data to train against, only
 * live current articles, so it can only ever be applied the same way FX and
 * the global benchmark are — a small, disclosed, present-moment adjustment
 * to the model's baseline, not a change to the model itself.
 */

const BASELINE_TRAINING_END = "2023-07-15"; // ml/models/metadata.json date_range[1] — matches the FX/benchmark baseline dates so "cumulative change" means the same period everywhere.
const BASELINE_TRAINING_END_DATE = new Date(BASELINE_TRAINING_END);

// FX pass-through: how much of the cedi's cumulative depreciation/appreciation
// against the dollar since the model's training window plausibly shows up in
// this commodity's price, given how import-exposed it really is (imported
// rice vs. a domestically grown tuber with only indirect fuel/input exposure).
const FX_PASSTHROUGH_DEFAULT = 0.12;
const FX_PASSTHROUGH: Record<string, number> = {
  "Rice (imported)": 0.45,
  "Rice (local)": 0.18,
  "Rice (paddy)": 0.15,
  Maize: 0.18,
  "Maize (yellow)": 0.18,
  "Meat (chicken)": 0.2, // broiler feed (maize/soy meal) and day-old chicks are commonly imported
  "Meat (chicken, local)": 0.15,
  "Fish (mackerel, fresh)": 0.15, // fuel for fishing fleets + imported frozen-fish competition
};

// Global benchmark pass-through: how much of the Pink Sheet's world-price
// move plausibly reaches the local Ghanaian price, given local supply,
// demand, and government interventions (e.g. import tariffs, buffer stocks)
// dampen the transmission well below 1:1.
const BENCHMARK_PASSTHROUGH = 0.25;

// News pressure pass-through: deliberately the smallest and most
// conservative coefficient of the three signals — it's the least validated
// (a hand-built keyword lexicon over a handful of recent articles, not a
// backtested relationship). At full-strength pressure (+/-1), this moves
// the estimate at most 8%, versus up to 45% for FX on import-heavy rice.
const NEWS_MAX_ADJUSTMENT_PCT = 8;

// Caps total adjustment magnitude so a large FX, benchmark, or news swing
// can't compound into an implausible central estimate — a disclosed safety
// rail, not a fitted parameter.
const MAX_ADJUSTMENT_PCT = 35;

// The real chronological-split backtest (ml/src/train.py) only tells you
// accuracy for dates near the training window — it says nothing about
// forecasting years past it. Every year of distance beyond
// BASELINE_TRAINING_END widens the disclosed range further, and beyond a
// couple of years the confidence label is capped regardless of how low the
// category's raw backtest error is, since that error was never measured
// this far out.
const WIDENING_PER_EXTRAPOLATION_YEAR = 0.15;
const MAX_HALF_WIDTH_PCT = 0.85;

export type ForecastSignal = {
  name: "fx" | "globalBenchmark" | "news";
  available: boolean;
  adjustmentPct: number;
  passthroughCoefficient: number;
  detail: string;
  fetchedAt?: string;
};

export type ForecastResult = {
  baselinePrice: number;
  baselineModelName: string;
  centralEstimate: number;
  lowEstimate: number;
  highEstimate: number;
  confidenceLabel: "moderate" | "low" | "very low";
  categoryMape: number | undefined;
  extrapolationYears: number;
  signals: ForecastSignal[];
  why: string[];
  dataFreshness: {
    modelTrainedThrough: string;
    fxAsOf: string | undefined;
    benchmarkAsOf: string | undefined;
    newsAsOf: string | undefined;
  };
  disclaimer: string;
};

function fxAdjustment(fx: FxSignal | undefined, commodityName: string): ForecastSignal {
  const coefficient = FX_PASSTHROUGH[commodityName] ?? FX_PASSTHROUGH_DEFAULT;
  if (!fx) {
    return {
      name: "fx",
      available: false,
      adjustmentPct: 0,
      passthroughCoefficient: coefficient,
      detail: "USD/GHS exchange-rate signal unavailable right now — forecast uses the statistical baseline only for this signal.",
    };
  }
  const adjustmentPct = fx.cumulativeChangePct * coefficient;
  const direction = fx.cumulativeChangePct >= 0 ? "depreciated" : "appreciated";
  return {
    name: "fx",
    available: true,
    adjustmentPct,
    passthroughCoefficient: coefficient,
    detail: `The cedi has ${direction} ${Math.abs(fx.cumulativeChangePct).toFixed(1)}% against the US dollar since ${fx.baselineLabel} (now ${fx.currentRate.toFixed(2)} GHS/USD as of ${fx.currentRateDate}). Applying a disclosed ${(coefficient * 100).toFixed(0)}% pass-through for this commodity's import exposure.`,
    fetchedAt: fx.fetchedAt,
  };
}

function benchmarkAdjustment(benchmark: GlobalBenchmarkSignal | undefined, commodityName: string): ForecastSignal {
  if (!benchmark) {
    return {
      name: "globalBenchmark",
      available: false,
      adjustmentPct: 0,
      passthroughCoefficient: BENCHMARK_PASSTHROUGH,
      detail: `No real international benchmark exists for ${commodityName} — it's a local/regional staple, not an internationally traded futures contract. This signal is marked not applicable, not estimated.`,
    };
  }
  const adjustmentPct = benchmark.cumulativeChangePct * BENCHMARK_PASSTHROUGH;
  const direction = benchmark.cumulativeChangePct >= 0 ? "risen" : "fallen";
  return {
    name: "globalBenchmark",
    available: true,
    adjustmentPct,
    passthroughCoefficient: BENCHMARK_PASSTHROUGH,
    detail: `The World Bank's global ${benchmark.seriesName} price has ${direction} ${Math.abs(benchmark.cumulativeChangePct).toFixed(1)}% since ${benchmark.baselineLabel} (latest: ${benchmark.currentPeriod}). Applying a disclosed ${(BENCHMARK_PASSTHROUGH * 100).toFixed(0)}% pass-through, since local price + government policy dampen full transmission.`,
    fetchedAt: benchmark.fetchedAt,
  };
}

function newsAdjustment(news: NewsSignal, fetchedAt: string): ForecastSignal {
  if (!news.available) {
    return {
      name: "news",
      available: false,
      adjustmentPct: 0,
      passthroughCoefficient: NEWS_MAX_ADJUSTMENT_PCT / 100,
      detail: news.detail,
    };
  }
  const adjustmentPct = news.pressureScore * NEWS_MAX_ADJUSTMENT_PCT;
  return {
    name: "news",
    available: true,
    adjustmentPct,
    passthroughCoefficient: NEWS_MAX_ADJUSTMENT_PCT / 100,
    detail: `${news.detail} This is the least validated of the three signals (a keyword scan, not a backtested relationship), so it's capped at a disclosed ±${NEWS_MAX_ADJUSTMENT_PCT}% maximum contribution.`,
    fetchedAt,
  };
}

/** Fractional years (can be negative if the target predates training end) between the model's training cutoff and the forecast target. */
function extrapolationYears(month: number, year: number): number {
  const target = new Date(Date.UTC(year, month - 1, 15));
  const ms = target.getTime() - BASELINE_TRAINING_END_DATE.getTime();
  return Math.max(0, ms / (1000 * 60 * 60 * 24 * 365.25));
}

function confidenceLabel(
  categoryMape: number | undefined,
  signalsAvailable: number,
  extrapYears: number,
): ForecastResult["confidenceLabel"] {
  // Beyond this much distance from what the backtest actually measured, cap
  // confidence regardless of how low the raw category error looks — the
  // backtest says nothing about accuracy this far past the training window.
  if (extrapYears > 4) return "very low";

  if (categoryMape === undefined) return "very low";
  // Thresholds set from this app's own real category MAPEs (37%-104%, see
  // ml/models/metadata.json) — "moderate" is the best this dataset ever
  // gets, not a generic small-error bar borrowed from another domain.
  const raw = categoryMape < 0.45 && signalsAvailable >= 1 ? "moderate" : categoryMape < 0.75 ? "low" : "very low";

  if (extrapYears > 2 && raw === "moderate") return "low";
  return raw;
}

export async function buildForecast(
  commodityId: string,
  commodityName: string,
  marketName: string,
  category: string,
  month: number,
  year: number,
): Promise<ForecastResult> {
  const [baseline, fx, benchmark, mlMetadata, news, seasonal] = await Promise.all([
    predictPrice({ commodity: commodityName, market: marketName, month, year }),
    getFxSignal(),
    getGlobalBenchmarkSignal(commodityName, BASELINE_TRAINING_END),
    getMlMetadata(),
    getNewsSignal(commodityName),
    getSeasonalContext(commodityId, commodityName, month),
  ]);

  const newsFetchedAt = new Date().toISOString();
  const fxSignal = fxAdjustment(fx, commodityName);
  const benchmarkSignal = benchmarkAdjustment(benchmark, commodityName);
  const newsSignal = newsAdjustment(news, newsFetchedAt);

  const rawAdjustmentPct = fxSignal.adjustmentPct + benchmarkSignal.adjustmentPct + newsSignal.adjustmentPct;
  const clampedAdjustmentPct = Math.max(-MAX_ADJUSTMENT_PCT, Math.min(MAX_ADJUSTMENT_PCT, rawAdjustmentPct));
  const centralEstimate = baseline.predictedPrice * (1 + clampedAdjustmentPct / 100);

  const extrapYears = extrapolationYears(month, year);
  const categoryMape = mlMetadata?.categoryMape[category];
  // MAPE is the real chronological-split backtest error for this category,
  // widened the further the target date sits past what that backtest
  // actually covered (see WIDENING_PER_EXTRAPOLATION_YEAR above), then
  // capped so the low end never goes non-positive.
  const baseHalfWidthPct = Math.min(categoryMape ?? 0.6, 0.6);
  const halfWidthPct = Math.min(baseHalfWidthPct * (1 + extrapYears * WIDENING_PER_EXTRAPOLATION_YEAR), MAX_HALF_WIDTH_PCT);
  const lowEstimate = Math.max(0, centralEstimate * (1 - halfWidthPct));
  const highEstimate = centralEstimate * (1 + halfWidthPct);

  const signalsAvailable = [fxSignal, benchmarkSignal, newsSignal].filter((s) => s.available).length;

  const why: string[] = [
    `Statistical baseline: ${baseline.modelName.replace(/_/g, " ")} model trained on real historical prices through ${BASELINE_TRAINING_END}, predicting ${commodityName} at ${marketName} for ${year}-${String(month).padStart(2, "0")}: ${baseline.predictedPrice.toFixed(2)} GHS.`,
    fxSignal.detail,
    benchmarkSignal.detail,
    newsSignal.detail,
    seasonal.detail,
    categoryMape !== undefined
      ? `Range width is this app's own real backtest error for "${category}" commodities (${(categoryMape * 100).toFixed(0)}% mean absolute percentage error, held out chronologically — see ml/reports/MODEL_EVALUATION.md)${extrapYears > 0.1 ? `, widened for being ~${extrapYears.toFixed(1)} years past the model's training window (${BASELINE_TRAINING_END}), which that backtest never measured` : ""}.`
      : "Backtest error metadata was unavailable, so the range defaults to this app's widest observed category error (60%).",
  ];

  return {
    baselinePrice: baseline.predictedPrice,
    baselineModelName: baseline.modelName,
    centralEstimate: Math.round(centralEstimate * 100) / 100,
    lowEstimate: Math.round(lowEstimate * 100) / 100,
    highEstimate: Math.round(highEstimate * 100) / 100,
    confidenceLabel: confidenceLabel(categoryMape, signalsAvailable, extrapYears),
    categoryMape,
    extrapolationYears: Math.round(extrapYears * 100) / 100,
    signals: [fxSignal, benchmarkSignal, newsSignal],
    why,
    dataFreshness: {
      modelTrainedThrough: BASELINE_TRAINING_END,
      fxAsOf: fx?.fetchedAt,
      benchmarkAsOf: benchmark?.fetchedAt,
      newsAsOf: news.available ? newsFetchedAt : undefined,
    },
    disclaimer:
      "This is a statistical estimate with a real, disclosed margin of error, not a guarantee. Actual prices depend on local supply, weather, transport, and policy changes this system cannot see.",
  };
}
