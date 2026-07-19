import AsyncStorage from "@react-native-async-storage/async-storage";
import { QueryClient } from "@tanstack/react-query";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";

const DAY_MS = 1000 * 60 * 60 * 24;

/**
 * Single shared React Query client. staleTime is generous because wholesale
 * price data updates at most monthly (see data/ghana_food_prices_clean.csv),
 * so aggressive refetching would just waste bandwidth on-device. gcTime is
 * bumped to a full day (React Query's default is 5 minutes) so persisted
 * queries — see persister below — actually survive being backgrounded
 * overnight instead of getting garbage-collected from memory first.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: DAY_MS,
      retry: 2,
      refetchOnReconnect: true,
    },
  },
});

/**
 * Persists successful query results to AsyncStorage so the app has
 * something to show when opened offline (PROJECT_REQUIREMENTS.md's
 * "offline-friendly where possible") — read-only stale data, not a
 * write-queue; mutations (sign-in, predictions) are never persisted and
 * always require a live connection.
 */
export const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: "pricemate-query-cache",
  throttleTime: 1000,
});

export const PERSIST_MAX_AGE = DAY_MS;
