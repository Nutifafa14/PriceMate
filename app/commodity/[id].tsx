import { Ionicons } from "@expo/vector-icons";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { ActivityIndicator, FlatList, Pressable, View } from "react-native";

import { CommodityCard } from "@/components/CommodityCard";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PriceChart,
  Screen,
  ScreenHeader,
  ThemedText,
} from "@/components/ui";
import { useCommodities, useCommodity, useLatestPrices, useMarket, useMarkets, usePrices } from "@/hooks";
import { useFavoritesStore } from "@/store/favorites-store";
import { useTheme } from "@/theme";
import { groupLatestWholesaleByCommodity, pickMostRecentWholesale } from "@/utils/prices";

const CHART_PREVIEW_POINTS = 12;

export default function CommodityDetailScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isFavorite = useFavoritesStore((state) => (id ? state.isFavorite(id) : false));
  const toggleFavorite = useFavoritesStore((state) => state.toggleFavorite);

  const commodityQuery = useCommodity(id);
  const latestPricesQuery = useLatestPrices({ commodityId: id });
  const defaultMarketPrice = useMemo(
    () => pickMostRecentWholesale(latestPricesQuery.data ?? []),
    [latestPricesQuery.data],
  );
  const marketId = defaultMarketPrice?.marketId;

  const marketQuery = useMarket(marketId);
  const recentPricesQuery = usePrices(
    { commodityId: id, marketId, priceType: "Wholesale", limit: CHART_PREVIEW_POINTS },
    { enabled: Boolean(marketId) },
  );
  const similarQuery = useCommodities(commodityQuery.data?.category);
  const allLatestPricesQuery = useLatestPrices();
  const marketsQuery = useMarkets();
  const latestByCommodity = useMemo(
    () => groupLatestWholesaleByCommodity(allLatestPricesQuery.data ?? []),
    [allLatestPricesQuery.data],
  );
  const marketNameById = useMemo(
    () => new Map((marketsQuery.data ?? []).map((m) => [m.id, m.name])),
    [marketsQuery.data],
  );

  if (commodityQuery.isLoading || latestPricesQuery.isLoading) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenHeader title="Commodity" />
        <ActivityIndicator color={theme.colors.accent} style={{ marginTop: theme.spacing.xl }} />
      </Screen>
    );
  }

  if (commodityQuery.isError || !commodityQuery.data) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenHeader title="Commodity" />
        <EmptyState
          icon="alert-circle-outline"
          title="Couldn't load this commodity"
          onAction={() => commodityQuery.refetch()}
        />
      </Screen>
    );
  }

  const commodity = commodityQuery.data;
  const recentPrices = [...(recentPricesQuery.data ?? [])].reverse(); // API returns date DESC; chart wants chronological
  const latest = defaultMarketPrice;
  const previous = recentPricesQuery.data?.[1];
  const changePct = latest && previous ? ((latest.price - previous.price) / previous.price) * 100 : null;
  const similar = (similarQuery.data ?? []).filter((c) => c.id !== commodity.id).slice(0, 6);

  return (
    <Screen scroll>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader
        title={commodity.name}
        rightElement={
          <Pressable
            hitSlop={8}
            onPress={() => toggleFavorite(commodity.id)}
            accessibilityLabel={isFavorite ? "Remove from favourites" : "Add to favourites"}
          >
            <Ionicons
              name={isFavorite ? "heart" : "heart-outline"}
              size={22}
              color={isFavorite ? theme.colors.danger : theme.colors.text}
            />
          </Pressable>
        }
      />
      <View style={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        {!latest ? (
          <EmptyState
            icon="pricetags-outline"
            title="No wholesale price data"
            description={`${commodity.name} only has retail price records in this dataset, so there's no wholesale price or forecast to show.`}
          />
        ) : (
          <>
            <Card style={{ gap: theme.spacing.sm }}>
              <ThemedText variant="caption" color="muted" style={{ textTransform: "capitalize" }}>
                {commodity.category}
              </ThemedText>
              <ThemedText variant="display" weight="bold">
                GHS {latest.price.toFixed(2)}
              </ThemedText>
              {changePct !== null ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.sm }}>
                  <Badge
                    label={`${changePct >= 0 ? "+" : ""}${changePct.toFixed(1)}% vs previous`}
                    tone={changePct > 0 ? "danger" : changePct < 0 ? "success" : "neutral"}
                  />
                </View>
              ) : null}
              <ThemedText variant="caption" color="muted">
                {marketQuery.data?.name ?? "…"} · {latest.unit} · {latest.priceType} · as of {latest.date}
              </ThemedText>
            </Card>

            <Card style={{ gap: theme.spacing.md }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <ThemedText variant="subtitle">Recent Trend</ThemedText>
                <Pressable onPress={() => router.push(`/history/${commodity.id}?marketId=${marketId}`)}>
                  <ThemedText variant="caption" color="accent" weight="semibold">
                    View full history
                  </ThemedText>
                </Pressable>
              </View>
              {recentPricesQuery.isLoading ? (
                <ActivityIndicator color={theme.colors.accent} />
              ) : (
                <>
                  <PriceChart data={recentPrices} />
                  <ThemedText variant="caption" color="muted">
                    Last {recentPrices.length} recorded prices at {marketQuery.data?.name ?? "this market"},
                    from the cleaned dataset.
                  </ThemedText>
                </>
              )}
            </Card>

            <Button
              label="Predict future price"
              variant="accent"
              onPress={() => router.push(`/prediction/${commodity.id}?marketId=${marketId}`)}
            />
          </>
        )}

        {similar.length > 0 ? (
          <View style={{ gap: theme.spacing.sm }}>
            <ThemedText variant="subtitle">Similar Commodities</ThemedText>
            <FlatList
              horizontal
              data={similar}
              keyExtractor={(item) => item.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: theme.spacing.md }}
              renderItem={({ item }) => (
                <View style={{ width: 160 }}>
                  <CommodityCard
                    commodity={item}
                    latestPrice={latestByCommodity.get(item.id)}
                    marketName={marketNameById.get(latestByCommodity.get(item.id)?.marketId ?? "")}
                    onPress={() => router.push(`/commodity/${item.id}`)}
                  />
                </View>
              )}
            />
          </View>
        ) : null}
      </View>
    </Screen>
  );
}
