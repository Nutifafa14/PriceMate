import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";
import type { CommunityPricePoint, PriceType } from "@/types";

export type CommunityPriceQueryParams = {
  commodityId?: string;
  marketId?: string;
  priceType?: PriceType;
  limit?: number;
  offset?: number;
};

function buildQuery(params: Record<string, string | number | undefined>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  }
  return parts.length ? `?${parts.join("&")}` : "";
}

/** Real MoFA SRID price reports — see CommunityPricePoint's doc comment for why these are never blended with usePrices/useLatestPrices. */
export function useCommunityPrices(params: CommunityPriceQueryParams, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["community-prices", params],
    queryFn: () => apiFetch<CommunityPricePoint[]>(`/community-prices${buildQuery(params)}`),
    enabled: options?.enabled ?? true,
  });
}
