import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type ThemeOverride = "system" | "light" | "dark";

type SettingsState = {
  themeOverride: ThemeOverride;
  setThemeOverride: (value: ThemeOverride) => void;
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      themeOverride: "system",
      setThemeOverride: (value) => set({ themeOverride: value }),
    }),
    {
      name: "pricemate-settings",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
