import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type FavoritesState = {
  commodityIds: string[];
  marketIds: string[];
  toggleFavorite: (commodityId: string) => void;
  isFavorite: (commodityId: string) => boolean;
  toggleFavoriteMarket: (marketId: string) => void;
  isFavoriteMarket: (marketId: string) => boolean;
  clearAll: () => void;
};

export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      commodityIds: [],
      marketIds: [],
      toggleFavorite: (commodityId) =>
        set((state) => ({
          commodityIds: state.commodityIds.includes(commodityId)
            ? state.commodityIds.filter((id) => id !== commodityId)
            : [...state.commodityIds, commodityId],
        })),
      isFavorite: (commodityId) => get().commodityIds.includes(commodityId),
      toggleFavoriteMarket: (marketId) =>
        set((state) => ({
          marketIds: state.marketIds.includes(marketId)
            ? state.marketIds.filter((id) => id !== marketId)
            : [...state.marketIds, marketId],
        })),
      isFavoriteMarket: (marketId) => get().marketIds.includes(marketId),
      clearAll: () => set({ commodityIds: [], marketIds: [] }),
    }),
    {
      name: "pricemate-favorites",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
