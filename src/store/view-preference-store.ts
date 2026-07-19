import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type CommodityViewMode = "grid" | "list";

type ViewPreferenceState = {
  commodityViewMode: CommodityViewMode;
  setCommodityViewMode: (mode: CommodityViewMode) => void;
};

/** Persisted view-mode choice, shared across every commodity listing (Home, Favourites, Market Detail). */
export const useViewPreferenceStore = create<ViewPreferenceState>()(
  persist(
    (set) => ({
      commodityViewMode: "grid",
      setCommodityViewMode: (mode) => set({ commodityViewMode: mode }),
    }),
    {
      name: "pricemate-view-preference",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
