import { router } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { CommodityCard } from "@/components/CommodityCard";
import { CommodityListItem } from "@/components/CommodityListItem";
import { MarketCard } from "@/components/MarketCard";
import {
  Card,
  CommodityCardSkeleton,
  EmptyState,
  Screen,
  TextField,
  ThemedText,
  ViewToggle,
} from "@/components/ui";
import { API_UNREACHABLE_HINT } from "@/constants/config";
import { useCommodities, useLatestPrices, useMarkets } from "@/hooks";
import { useAuthStore } from "@/store/auth-store";
import { useViewPreferenceStore } from "@/store/view-preference-store";
import { useTheme } from "@/theme";
import { CATEGORY_VALUES, type Category } from "@/types";
import { groupLatestWholesaleByCommodity } from "@/utils/prices";

export default function HomeScreen() {
  const theme = useTheme();
  const user = useAuthStore((state) => state.user);
  const viewMode = useViewPreferenceStore((state) => state.commodityViewMode);
  const setViewMode = useViewPreferenceStore((state) => state.setCommodityViewMode);
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);
  const [query, setQuery] = useState("");

  const commoditiesQuery = useCommodities(activeCategory ?? undefined);
  const latestPricesQuery = useLatestPrices();
  const marketsQuery = useMarkets();

  const latestByCommodity = useMemo(
    () => groupLatestWholesaleByCommodity(latestPricesQuery.data ?? []),
    [latestPricesQuery.data],
  );
  const marketNameById = useMemo(
    () => new Map((marketsQuery.data ?? []).map((m) => [m.id, m.name])),
    [marketsQuery.data],
  );

  const commodities = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = commoditiesQuery.data ?? [];
    return q ? list.filter((c) => c.name.toLowerCase().includes(q)) : list;
  }, [commoditiesQuery.data, query]);

  const isLoading = commoditiesQuery.isLoading || marketsQuery.isLoading;
  const isError = commoditiesQuery.isError || marketsQuery.isError || latestPricesQuery.isError;

  return (
    <Screen scroll edges={["top"]}>
      <View style={{ paddingTop: theme.spacing.md, gap: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View>
            <ThemedText variant="caption" color="muted">
              Welcome back
            </ThemedText>
            <ThemedText variant="title">{user?.name ?? "Guest"} 👋</ThemedText>
          </View>
          <Pressable
            onPress={() => router.push("/(tabs)/profile")}
            accessibilityLabel="Open profile"
            style={{
              width: 44,
              height: 44,
              borderRadius: theme.radius.pill,
              backgroundColor: theme.colors.primary,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ThemedText variant="subtitle" color="onPrimary">
              {(user?.name ?? "G").charAt(0).toUpperCase()}
            </ThemedText>
          </Pressable>
        </View>

        <TextField
          placeholder="Search commodities"
          value={query}
          onChangeText={setQuery}
          leftElement={<Ionicons name="search" size={18} color={theme.colors.textMuted} />}
        />

        <Card style={{ backgroundColor: theme.colors.primary, gap: theme.spacing.xs }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.xs }}>
            <Ionicons name="stats-chart-outline" size={16} color={theme.colors.accent} />
            <ThemedText variant="caption" color="onPrimary" style={{ opacity: 0.8 }}>
              Market Insight
            </ThemedText>
          </View>
          <ThemedText variant="subtitle" color="onPrimary">
            8,543 verified price records across 20 markets (2015–2023)
          </ThemedText>
          <ThemedText variant="caption" color="onPrimary" style={{ opacity: 0.7 }}>
            Tap a commodity, then &quot;Predict future price&quot; for an AI estimate
          </ThemedText>
        </Card>

        <View style={{ gap: theme.spacing.sm }}>
          <ThemedText variant="subtitle">Categories</ThemedText>
          <FlatList
            horizontal
            data={CATEGORY_VALUES}
            keyExtractor={(item) => item}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: theme.spacing.sm }}
            renderItem={({ item }) => {
              const active = activeCategory === item;
              return (
                <Pressable onPress={() => setActiveCategory(active ? null : item)}>
                  <View
                    style={{
                      paddingHorizontal: theme.spacing.md,
                      paddingVertical: theme.spacing.sm,
                      borderRadius: theme.radius.pill,
                      backgroundColor: active ? theme.colors.accent : theme.colors.card,
                      borderWidth: active ? 0 : 1,
                      borderColor: theme.colors.border,
                    }}
                  >
                    <ThemedText
                      variant="caption"
                      weight="medium"
                      color={active ? "onAccent" : "primary"}
                      style={{ textTransform: "capitalize" }}
                    >
                      {item}
                    </ThemedText>
                  </View>
                </Pressable>
              );
            }}
          />
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <ThemedText variant="subtitle">Markets</ThemedText>
          <FlatList
            horizontal
            data={(marketsQuery.data ?? []).slice(0, 8)}
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: theme.spacing.sm }}
            renderItem={({ item }) => (
              <MarketCard market={item} onPress={() => router.push(`/market/${item.id}`)} />
            )}
          />
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <ThemedText variant="subtitle">{query ? "Search results" : "Popular Commodities"}</ThemedText>
            <ViewToggle value={viewMode} onChange={setViewMode} />
          </View>
          {isLoading ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.md }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <View key={i} style={{ width: "47%" }}>
                  <CommodityCardSkeleton />
                </View>
              ))}
            </View>
          ) : isError ? (
            <EmptyState
              icon="cloud-offline-outline"
              title="Couldn't load commodities"
              description={API_UNREACHABLE_HINT}
              onAction={() => {
                commoditiesQuery.refetch();
                marketsQuery.refetch();
                latestPricesQuery.refetch();
              }}
            />
          ) : commodities.length === 0 ? (
            <ThemedText variant="body" color="muted">
              No commodities match your search.
            </ThemedText>
          ) : viewMode === "list" ? (
            <View style={{ gap: theme.spacing.sm }}>
              {commodities.map((commodity) => (
                <CommodityListItem
                  key={commodity.id}
                  commodity={commodity}
                  latestPrice={latestByCommodity.get(commodity.id)}
                  marketName={marketNameById.get(latestByCommodity.get(commodity.id)?.marketId ?? "")}
                  onPress={() => router.push(`/commodity/${commodity.id}`)}
                />
              ))}
            </View>
          ) : (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.md }}>
              {commodities.map((commodity) => (
                <View key={commodity.id} style={{ width: "47%" }}>
                  <CommodityCard
                    commodity={commodity}
                    latestPrice={latestByCommodity.get(commodity.id)}
                    marketName={marketNameById.get(latestByCommodity.get(commodity.id)?.marketId ?? "")}
                    onPress={() => router.push(`/commodity/${commodity.id}`)}
                  />
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    </Screen>
  );
}
