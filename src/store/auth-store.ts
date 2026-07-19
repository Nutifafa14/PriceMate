import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { User } from "@/types";

type AuthState = {
  user: User | null;
  hasCompletedOnboarding: boolean;
  isHydrated: boolean;
  setHydrated: () => void;
  signIn: (user: User) => void;
  signOut: () => void;
  completeOnboarding: () => void;
};

/**
 * Holds the signed-in user's profile only — the JWT lives separately in
 * src/lib/token-store.ts (SecureStore, not AsyncStorage), since it's
 * sensitive and this store's contents are plain-text on disk. signIn/signOut
 * callers are responsible for setToken/clearToken alongside these calls
 * (see app/(auth)/sign-in.tsx, app/settings.tsx).
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      hasCompletedOnboarding: false,
      isHydrated: false,
      setHydrated: () => set({ isHydrated: true }),
      signIn: (user) => set({ user }),
      signOut: () => set({ user: null }),
      completeOnboarding: () => set({ hasCompletedOnboarding: true }),
    }),
    {
      name: "pricemate-auth",
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    },
  ),
);
