import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";
import type { NewsArticle } from "@/types";

// Built by hand rather than via URLSearchParams — matches the convention in
// usePrices.ts/useCommunityPrices.ts (RN/Hermes support isn't guaranteed
// across environments).
function buildQuery(params: Record<string, string | undefined>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
  }
  return parts.length ? `?${parts.join("&")}` : "";
}

/**
 * Real Ghana food/agriculture news, server-cached (see
 * server/src/lib/news-client.ts) — always resolves to an array, possibly
 * empty if the feed isn't configured or is temporarily unavailable. Pass a
 * commodity name for a real, commodity-scoped feed (its own GNews query +
 * relevance check server-side); omit it for the general feed.
 */
export function useNews(commodity?: string) {
  return useQuery({
    queryKey: ["news", commodity ?? "general"],
    queryFn: () => apiFetch<NewsArticle[]>(`/news${buildQuery({ commodity })}`),
    staleTime: 60 * 60 * 1000, // 1h — matches the server's own multi-hour cache
  });
}
