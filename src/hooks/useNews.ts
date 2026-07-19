import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";
import type { NewsArticle } from "@/types";

/** Ghana food/agriculture news, server-cached (see server/src/lib/news-client.ts) — always resolves to an array, possibly empty if the feed isn't configured or is temporarily unavailable. */
export function useNews() {
  return useQuery({
    queryKey: ["news"],
    queryFn: () => apiFetch<NewsArticle[]>("/news"),
    staleTime: 60 * 60 * 1000, // 1h — matches the server's own multi-hour cache
  });
}
