import { router } from "expo-router";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Card, Screen, ThemedText } from "@/components/ui";
import { clearToken } from "@/lib/token-store";
import { useAuthStore } from "@/store/auth-store";
import { useFavoritesStore } from "@/store/favorites-store";
import { useTheme } from "@/theme";

export default function ProfileScreen() {
  const theme = useTheme();
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);
  const favoriteCount = useFavoritesStore((state) => state.commodityIds.length + state.marketIds.length);

  const onSignOut = async () => {
    await clearToken();
    signOut();
    router.replace("/(auth)/sign-in");
  };

  return (
    <Screen scroll edges={["top"]}>
      <View style={{ paddingTop: theme.spacing.md, gap: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <ThemedText variant="title">Profile</ThemedText>

        <Card style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: theme.radius.pill,
              backgroundColor: theme.colors.primary,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ThemedText variant="subtitle" color="onPrimary">
              {(user?.name ?? "G").charAt(0).toUpperCase()}
            </ThemedText>
          </View>
          <View>
            <ThemedText variant="subtitle">{user?.name ?? "Guest"}</ThemedText>
            <ThemedText variant="caption" color="muted">
              {user?.email ?? "Not signed in"}
            </ThemedText>
          </View>
        </Card>

        <Pressable
          onPress={() => router.push("/(tabs)/favorites")}
          accessible
          accessibilityRole="button"
          accessibilityLabel={`${favoriteCount} ${favoriteCount === 1 ? "commodity" : "commodities"} favourited. View favourites.`}
        >
          <Card style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: theme.radius.md,
                backgroundColor: theme.colors.dangerBg,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="heart" size={20} color={theme.colors.danger} />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText variant="subtitle">{favoriteCount}</ThemedText>
              <ThemedText variant="caption" color="muted">
                {favoriteCount === 1 ? "commodity favourited" : "commodities favourited"}
              </ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
          </Card>
        </Pressable>

        <Card padded={false} style={{ overflow: "hidden" }}>
          <Pressable
            onPress={() => router.push("/settings")}
            accessibilityRole="button"
            accessibilityLabel="Settings"
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: theme.spacing.md,
              padding: theme.spacing.md,
            }}
          >
            <Ionicons name="settings-outline" size={20} color={theme.colors.textMuted} />
            <ThemedText variant="body" style={{ flex: 1 }}>
              Settings
            </ThemedText>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
          </Pressable>
        </Card>

        <Pressable
          onPress={onSignOut}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: theme.spacing.sm,
            padding: theme.spacing.md,
          }}
        >
          <Ionicons name="log-out-outline" size={20} color={theme.colors.danger} />
          <ThemedText variant="body" color="danger" weight="semibold">
            Sign out
          </ThemedText>
        </Pressable>

        <ThemedText variant="label" color="muted" style={{ textAlign: "center" }}>
          PriceMate v1.0.0
        </ThemedText>
      </View>
    </Screen>
  );
}
