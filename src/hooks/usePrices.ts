import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";
import type { PriceType, PricePoint } from "@/types";

export type PriceQueryParams = {
  commodityId?: string;
  marketId?: string;
  priceType?: PriceType;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
};

// Built by hand rather than via URLSearchParams — RN/Hermes support for it
// isn't guaranteed across environments, and this needs zero risk of a
// runtime crash (Expo Go compatibility is a hard requirement).
function buildQuery(params: Record<string, string | number | undefined>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  }
  return parts.length ? `?${parts.join("&")}` : "";
}

export function usePrices(params: PriceQueryParams, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["prices", params],
    queryFn: () => apiFetch<PricePoint[]>(`/prices${buildQuery(params)}`),
    enabled: options?.enabled ?? true,
  });
}

export function useLatestPrices(
  params: { commodityId?: string; marketId?: string } = {},
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: ["prices", "latest", params],
    queryFn: () => apiFetch<PricePoint[]>(`/prices/latest${buildQuery(params)}`),
    enabled: options?.enabled ?? true,
  });
}
