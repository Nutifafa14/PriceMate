import { Ionicons } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import { Alert, Pressable, View } from "react-native";

import { Card, Screen, ScreenHeader, SegmentedControl, ThemedText } from "@/components/ui";
import { clearToken } from "@/lib/token-store";
import { useAuthStore } from "@/store/auth-store";
import { useFavoritesStore } from "@/store/favorites-store";
import { useSettingsStore } from "@/store/settings-store";
import { useTheme } from "@/theme";

const APPEARANCE_OPTIONS = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
] as const;

export default function SettingsScreen() {
  const theme = useTheme();
  const themeOverride = useSettingsStore((state) => state.themeOverride);
  const setThemeOverride = useSettingsStore((state) => state.setThemeOverride);
  const favoriteCount = useFavoritesStore((state) => state.commodityIds.length + state.marketIds.length);
  const clearFavorites = useFavoritesStore((state) => state.clearAll);
  const signOut = useAuthStore((state) => state.signOut);

  const onClearFavorites = () => {
    if (favoriteCount === 0) return;
    Alert.alert(
      "Clear favourites?",
      `This removes all ${favoriteCount} favourited commodities and markets.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Clear", style: "destructive", onPress: clearFavorites },
      ],
    );
  };

  const onSignOut = async () => {
    await clearToken();
    signOut();
    router.replace("/(auth)/sign-in");
  };

  return (
    <Screen scroll>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title="Settings" />
      <View style={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <View style={{ gap: theme.spacing.sm }}>
          <ThemedText variant="label" color="muted">
            APPEARANCE
          </ThemedText>
          <Card>
            <SegmentedControl
              options={[...APPEARANCE_OPTIONS]}
              value={themeOverride}
              onChange={setThemeOverride}
            />
          </Card>
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <ThemedText variant="label" color="muted">
            DATA
          </ThemedText>
          <Card padded={false} style={{ overflow: "hidden" }}>
            <Pressable
              onPress={onClearFavorites}
              disabled={favoriteCount === 0}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: theme.spacing.md,
                padding: theme.spacing.md,
                opacity: favoriteCount === 0 ? 0.5 : 1,
              }}
            >
              <Ionicons name="trash-outline" size={20} color={theme.colors.danger} />
              <ThemedText variant="body" color="danger" style={{ flex: 1 }}>
                Clear favourites
              </ThemedText>
              <ThemedText variant="caption" color="muted">
                {favoriteCount}
              </ThemedText>
            </Pressable>
          </Card>
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <ThemedText variant="label" color="muted">
            ACCOUNT
          </ThemedText>
          <Card padded={false} style={{ overflow: "hidden" }}>
            <Pressable
              onPress={onSignOut}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: theme.spacing.md,
                padding: theme.spacing.md,
              }}
            >
              <Ionicons name="log-out-outline" size={20} color={theme.colors.danger} />
              <ThemedText variant="body" color="danger" style={{ flex: 1 }}>
                Sign out
              </ThemedText>
            </Pressable>
          </Card>
        </View>

        <ThemedText variant="label" color="muted" style={{ textAlign: "center" }}>
          PriceMate v1.0.0
        </ThemedText>
      </View>
    </Screen>
  );
}
