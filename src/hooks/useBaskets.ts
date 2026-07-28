import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";
import type { BasketItemInput, BasketOptimizationResult, SavedBasketDetail, SavedBasketSummary } from "@/types";

/** Real-time basket optimization over live price data — see server/src/lib/basket-optimizer.ts. Public endpoint, no save required. */
export function useOptimizeBasket() {
  return useMutation({
    mutationFn: (items: BasketItemInput[]) =>
      apiFetch<BasketOptimizationResult>("/baskets/optimize", { method: "POST", body: JSON.stringify({ items }) }),
  });
}

export function useSavedBaskets() {
  return useQuery({
    queryKey: ["baskets"],
    queryFn: () => apiFetch<SavedBasketSummary[]>("/baskets"),
  });
}

export function useSavedBasket(id: string | undefined) {
  return useQuery({
    queryKey: ["baskets", id],
    queryFn: () => apiFetch<SavedBasketDetail>(`/baskets/${id}`),
    enabled: Boolean(id),
  });
}

export function useSaveBasket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; items: BasketItemInput[] }) =>
      apiFetch<SavedBasketDetail>("/baskets", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["baskets"] }),
  });
}

export function useDeleteBasket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/baskets/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["baskets"] }),
  });
}

export function useOptimizeSavedBasket() {
  return useMutation({
    mutationFn: (id: string) => apiFetch<BasketOptimizationResult>(`/baskets/${id}/optimize`, { method: "POST" }),
  });
}
