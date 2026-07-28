import { router } from "expo-router";
import { useMemo, useState } from "react";
import { View } from "react-native";

import { CommodityCard } from "@/components/CommodityCard";
import { CommodityListItem } from "@/components/CommodityListItem";
import { MarketRow } from "@/components/MarketRow";
import {
  CommodityCardSkeleton,
  EmptyState,
  MarketRowSkeleton,
  Screen,
  SegmentedControl,
  ThemedText,
  ViewToggle,
} from "@/components/ui";
import { API_UNREACHABLE_HINT } from "@/constants/config";
import { useCommodities, useLatestPrices, useMarkets } from "@/hooks";
import { useFavoritesStore } from "@/store/favorites-store";
import { useViewPreferenceStore } from "@/store/view-preference-store";
import { useTheme } from "@/theme";
import { groupLatestWholesaleByCommodity } from "@/utils/prices";

type FavoritesTab = "commodities" | "markets";

export default function FavoritesScreen() {
  const theme = useTheme();
  const [tab, setTab] = useState<FavoritesTab>("commodities");
  const favoriteCommodityIds = useFavoritesStore((state) => state.commodityIds);
  const favoriteMarketIds = useFavoritesStore((state) => state.marketIds);

  const commoditiesQuery = useCommodities();
  const latestPricesQuery = useLatestPrices();
  const marketsQuery = useMarkets();

  const favoriteCommodities = useMemo(
    () => (commoditiesQuery.data ?? []).filter((c) => favoriteCommodityIds.includes(c.id)),
    [commoditiesQuery.data, favoriteCommodityIds],
  );
  const favoriteMarkets = useMemo(
    () => (marketsQuery.data ?? []).filter((m) => favoriteMarketIds.includes(m.id)),
    [marketsQuery.data, favoriteMarketIds],
  );
  const latestByCommodity = useMemo(
    () => groupLatestWholesaleByCommodity(latestPricesQuery.data ?? []),
    [latestPricesQuery.data],
  );
  const marketNameById = useMemo(
    () => new Map((marketsQuery.data ?? []).map((m) => [m.id, m.name])),
    [marketsQuery.data],
  );

  const viewMode = useViewPreferenceStore((state) => state.commodityViewMode);
  const setViewMode = useViewPreferenceStore((state) => state.setCommodityViewMode);

  const totalFavorites = favoriteCommodityIds.length + favoriteMarketIds.length;

  return (
    <Screen scroll edges={["top"]}>
      <View style={{ paddingTop: theme.spacing.md, gap: theme.spacing.md, paddingBottom: theme.spacing.xxl }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View>
            <ThemedText variant="title">Favourites</ThemedText>
            {totalFavorites > 0 ? (
              <ThemedText variant="caption" color="muted">
                {favoriteCommodityIds.length} commodit{favoriteCommodityIds.length === 1 ? "y" : "ies"} ·{" "}
                {favoriteMarketIds.length} market{favoriteMarketIds.length === 1 ? "" : "s"}
              </ThemedText>
            ) : null}
          </View>
          {tab === "commodities" && favoriteCommodities.length > 0 ? (
            <ViewToggle value={viewMode} onChange={setViewMode} />
          ) : null}
        </View>

        <SegmentedControl<FavoritesTab>
          value={tab}
          onChange={setTab}
          options={[
            { value: "commodities", label: "Commodities" },
            { value: "markets", label: "Markets" },
          ]}
        />

        {tab === "commodities" ? (
          commoditiesQuery.isLoading ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.md }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <View key={i} style={{ width: "47%" }}>
                  <CommodityCardSkeleton />
                </View>
              ))}
            </View>
          ) : commoditiesQuery.isError ? (
            <EmptyState
              icon="cloud-offline-outline"
              title="Couldn't load favourites"
              description={API_UNREACHABLE_HINT}
              onAction={() => commoditiesQuery.refetch()}
            />
          ) : favoriteCommodities.length === 0 ? (
            <EmptyState
              icon="heart-outline"
              title="No favourite commodities yet"
              description="Tap the heart icon on any commodity to track it here."
              actionLabel="Explore commodities"
              onAction={() => router.push("/(tabs)")}
            />
          ) : viewMode === "list" ? (
            <View style={{ gap: theme.spacing.sm }}>
              {favoriteCommodities.map((item) => (
                <CommodityListItem
                  key={item.id}
                  commodity={item}
                  latestPrice={latestByCommodity.get(item.id)}
                  marketName={marketNameById.get(latestByCommodity.get(item.id)?.marketId ?? "")}
                  onPress={() => router.push(`/commodity/${item.id}`)}
                />
              ))}
            </View>
          ) : (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.md }}>
              {favoriteCommodities.map((item) => (
                <View key={item.id} style={{ width: "47%" }}>
                  <CommodityCard
                    commodity={item}
                    latestPrice={latestByCommodity.get(item.id)}
                    marketName={marketNameById.get(latestByCommodity.get(item.id)?.marketId ?? "")}
                    onPress={() => router.push(`/commodity/${item.id}`)}
                  />
                </View>
              ))}
            </View>
          )
        ) : marketsQuery.isLoading ? (
          <View style={{ gap: theme.spacing.sm }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <MarketRowSkeleton key={i} />
            ))}
          </View>
        ) : marketsQuery.isError ? (
          <EmptyState
            icon="cloud-offline-outline"
            title="Couldn't load favourites"
            description={API_UNREACHABLE_HINT}
            onAction={() => marketsQuery.refetch()}
          />
        ) : favoriteMarkets.length === 0 ? (
          <EmptyState
            icon="heart-outline"
            title="No favourite markets yet"
            description="Tap the heart icon on any market to track it here."
            actionLabel="Explore markets"
            onAction={() => router.push("/(tabs)/markets")}
          />
        ) : (
          <View style={{ gap: theme.spacing.sm }}>
            {favoriteMarkets.map((item) => (
              <MarketRow key={item.id} market={item} onPress={() => router.push(`/market/${item.id}`)} />
            ))}
          </View>
        )}
      </View>
    </Screen>
  );
}
