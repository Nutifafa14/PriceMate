import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type FavoritesState = {
  commodityIds: string[];
  toggleFavorite: (commodityId: string) => void;
  isFavorite: (commodityId: string) => boolean;
  clearAll: () => void;
};

export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      commodityIds: [],
      toggleFavorite: (commodityId) =>
        set((state) => ({
          commodityIds: state.commodityIds.includes(commodityId)
            ? state.commodityIds.filter((id) => id !== commodityId)
            : [...state.commodityIds, commodityId],
        })),
      isFavorite: (commodityId) => get().commodityIds.includes(commodityId),
      clearAll: () => set({ commodityIds: [] }),
    }),
    {
      name: "pricemate-favorites",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
