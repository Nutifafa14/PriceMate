import { Redirect } from "expo-router";

import { useAuthStore } from "@/store/auth-store";

/**
 * Pure redirect gate. app/_layout.tsx already blocks rendering until the
 * auth store has rehydrated from AsyncStorage, so these reads are safe.
 */
export default function Index() {
  const user = useAuthStore((state) => state.user);
  const hasCompletedOnboarding = useAuthStore((state) => state.hasCompletedOnboarding);

  if (!hasCompletedOnboarding) {
    return <Redirect href="/(auth)/welcome" />;
  }
  if (!user) {
    return <Redirect href="/(auth)/sign-in" />;
  }
  return <Redirect href="/(tabs)" />;
}
