import { useMutation } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";
import type { PredictionPoint } from "@/types";

export type PredictInput = {
  commodityId: string;
  marketId: string;
  month: number;
  year: number;
};

/** POSTs to /api/predictions, which calls the live ML API and persists the result. */
export function usePredictPrice() {
  return useMutation({
    mutationFn: (input: PredictInput) =>
      apiFetch<PredictionPoint>("/predictions", { method: "POST", body: JSON.stringify(input) }),
  });
}
