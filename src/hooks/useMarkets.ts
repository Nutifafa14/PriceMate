import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";
import type { Market } from "@/types";

export function useMarkets(region?: string) {
  return useQuery({
    queryKey: ["markets", region ?? null],
    queryFn: () => apiFetch<Market[]>(`/markets${region ? `?region=${encodeURIComponent(region)}` : ""}`),
  });
}

export function useMarket(id: string | undefined) {
  return useQuery({
    queryKey: ["market", id],
    queryFn: () => apiFetch<Market>(`/markets/${id}`),
    enabled: Boolean(id),
  });
}
