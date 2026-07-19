import { useEffect, useState } from "react";
import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  useFonts,
} from "@expo-google-fonts/poppins";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PERSIST_MAX_AGE, asyncStoragePersister, queryClient } from "@/lib/query-client";
import { loadToken } from "@/lib/token-store";
import { useAuthStore } from "@/store/auth-store";
import { ThemeProvider, useTheme } from "@/theme";

SplashScreen.preventAutoHideAsync().catch(() => {
  // no-op: acceptable if the splash module isn't ready yet on web
});

function RootNavigator() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="commodity/[id]" />
      <Stack.Screen name="market/[id]" />
      <Stack.Screen name="prediction/[id]" />
      <Stack.Screen name="history/[id]" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });
  const isAuthHydrated = useAuthStore((state) => state.isHydrated);
  const [tokenLoaded, setTokenLoaded] = useState(false);
  const ready = (fontsLoaded || Boolean(fontError)) && isAuthHydrated && tokenLoaded;

  useEffect(() => {
    loadToken().finally(() => setTokenLoaded(true));
  }, []);

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [ready]);

  if (!ready) {
    return null;
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <PersistQueryClientProvider
            client={queryClient}
            persistOptions={{ persister: asyncStoragePersister, maxAge: PERSIST_MAX_AGE }}
          >
            <ThemeProvider>
              <StatusBar style="auto" />
              <RootNavigator />
            </ThemeProvider>
          </PersistQueryClientProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
