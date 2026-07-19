import { router } from "expo-router";
import { useMemo } from "react";
import { FlatList, View } from "react-native";

import { CommodityCard } from "@/components/CommodityCard";
import { CommodityListItem } from "@/components/CommodityListItem";
import { CommodityCardSkeleton, EmptyState, Screen, ThemedText, ViewToggle } from "@/components/ui";
import { API_UNREACHABLE_HINT } from "@/constants/config";
import { useCommodities, useLatestPrices, useMarkets } from "@/hooks";
import { useFavoritesStore } from "@/store/favorites-store";
import { useTheme } from "@/theme";
import { useViewPreferenceStore } from "@/store/view-preference-store";
import { groupLatestWholesaleByCommodity } from "@/utils/prices";

export default function FavoritesScreen() {
  const theme = useTheme();
  const favoriteIds = useFavoritesStore((state) => state.commodityIds);

  const commoditiesQuery = useCommodities();
  const latestPricesQuery = useLatestPrices();
  const marketsQuery = useMarkets();

  const favorites = useMemo(
    () => (commoditiesQuery.data ?? []).filter((c) => favoriteIds.includes(c.id)),
    [commoditiesQuery.data, favoriteIds],
  );
  const latestByCommodity = useMemo(
    () => groupLatestWholesaleByCommodity(latestPricesQuery.data ?? []),
    [latestPricesQuery.data],
  );
  const marketNameById = useMemo(
    () => new Map((marketsQuery.data ?? []).map((m) => [m.id, m.name])),
    [marketsQuery.data],
  );

  const isLoading = commoditiesQuery.isLoading;
  const isError = commoditiesQuery.isError;
  const viewMode = useViewPreferenceStore((state) => state.commodityViewMode);
  const setViewMode = useViewPreferenceStore((state) => state.setCommodityViewMode);

  return (
    <Screen edges={["top"]}>
      <View style={{ paddingTop: theme.spacing.md, gap: theme.spacing.md, flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View>
            <ThemedText variant="title">Favourites</ThemedText>
            {favorites.length > 0 ? (
              <ThemedText variant="caption" color="muted">
                {favorites.length} commodit{favorites.length === 1 ? "y" : "ies"}
              </ThemedText>
            ) : null}
          </View>
          {favorites.length > 0 ? <ViewToggle value={viewMode} onChange={setViewMode} /> : null}
        </View>

        {isLoading ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.md }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <View key={i} style={{ width: "47%" }}>
                <CommodityCardSkeleton />
              </View>
            ))}
          </View>
        ) : isError ? (
          <EmptyState
            icon="cloud-offline-outline"
            title="Couldn't load favourites"
            description={API_UNREACHABLE_HINT}
            onAction={() => commoditiesQuery.refetch()}
          />
        ) : favorites.length === 0 ? (
          <EmptyState
            icon="heart-outline"
            title="No favourites yet"
            description="Tap the heart icon on any commodity to track it here."
          />
        ) : viewMode === "list" ? (
          <FlatList
            key="list"
            data={favorites}
            keyExtractor={(item) => item.id}
            style={{ flex: 1 }}
            contentContainerStyle={{ gap: theme.spacing.sm, paddingBottom: theme.spacing.xxl }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <CommodityListItem
                commodity={item}
                latestPrice={latestByCommodity.get(item.id)}
                marketName={marketNameById.get(latestByCommodity.get(item.id)?.marketId ?? "")}
                onPress={() => router.push(`/commodity/${item.id}`)}
              />
            )}
          />
        ) : (
          <FlatList
            key="grid"
            data={favorites}
            keyExtractor={(item) => item.id}
            style={{ flex: 1 }}
            numColumns={2}
            columnWrapperStyle={{ gap: theme.spacing.md }}
            contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: theme.spacing.xxl }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <View style={{ flex: 1 }}>
                <CommodityCard
                  commodity={item}
                  latestPrice={latestByCommodity.get(item.id)}
                  marketName={marketNameById.get(latestByCommodity.get(item.id)?.marketId ?? "")}
                  onPress={() => router.push(`/commodity/${item.id}`)}
                />
              </View>
            )}
          />
        )}
      </View>
    </Screen>
  );
}
