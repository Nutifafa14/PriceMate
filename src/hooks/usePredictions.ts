import { useMutation } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";
import type { ForecastResult } from "@/types";

export type PredictInput = {
  commodityId: string;
  marketId: string;
  month: number;
  year: number;
};

/**
 * POSTs to /api/predictions, which runs the full forecast pipeline (ML
 * baseline + FX/global-benchmark signal adjustment + backtest-derived
 * range/confidence, see server/src/lib/forecast-pipeline.ts) and persists
 * both the baseline prediction and a forecast_runs audit row.
 */
export function usePredictPrice() {
  return useMutation({
    mutationFn: (input: PredictInput) =>
      apiFetch<ForecastResult>("/predictions", { method: "POST", body: JSON.stringify(input) }),
  });
}
