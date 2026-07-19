import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";
import type { Category, Commodity } from "@/types";

export function useCommodities(category?: Category) {
  return useQuery({
    queryKey: ["commodities", category ?? null],
    queryFn: () =>
      apiFetch<Commodity[]>(`/commodities${category ? `?category=${encodeURIComponent(category)}` : ""}`),
  });
}

export function useCommodity(id: string | undefined) {
  return useQuery({
    queryKey: ["commodity", id],
    queryFn: () => apiFetch<Commodity>(`/commodities/${id}`),
    enabled: Boolean(id),
  });
}
