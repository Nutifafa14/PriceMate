import React, { useMemo, useState } from "react";
import { Animated, Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Badge, Card, ThemedText } from "@/components/ui";
import { useCommodities, useLatestPrices } from "@/hooks";
import { useFavoritesStore } from "@/store/favorites-store";
import { useTheme } from "@/theme";
import {
  computeMarketPriceStats,
  getMarketCommodityNames,
  PRICE_LEVEL_LABEL,
  PRICE_LEVEL_TONE,
} from "@/utils/market-stats";
import type { Market } from "@/types";

export type MarketRowProps = {
  market: Market;
  onPress?: () => void;
};

export const MarketRow = React.memo(function MarketRow({ market, onPress }: MarketRowProps) {
  const theme = useTheme();
  const isFavorite = useFavoritesStore((state) => state.isFavoriteMarket(market.id));
  const toggleFavoriteMarket = useFavoritesStore((state) => state.toggleFavoriteMarket);
  const [heartScale] = useState(() => new Animated.Value(1));

  // React Query dedupes these across every MarketRow instance on screen —
  // one shared cache entry, not one fetch per row.
  const latestPricesQuery = useLatestPrices();
  const commoditiesQuery = useCommodities();
  const commodityById = useMemo(
    () => new Map((commoditiesQuery.data ?? []).map((c) => [c.id, c])),
    [commoditiesQuery.data],
  );
  const priceStats = useMemo(
    () => computeMarketPriceStats(latestPricesQuery.data ?? [], market.id),
    [latestPricesQuery.data, market.id],
  );
  const popularCommodities = useMemo(
    () => getMarketCommodityNames(latestPricesQuery.data ?? [], market.id, commodityById),
    [latestPricesQuery.data, market.id, commodityById],
  );

  const handleToggleFavorite = () => {
    toggleFavoriteMarket(market.id);
    Animated.sequence([
      Animated.spring(heartScale, { toValue: 1.3, useNativeDriver: true, speed: 50, bounciness: 12 }),
      Animated.spring(heartScale, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 12 }),
    ]).start();
  };

  return (
    <Pressable
      onPress={onPress}
      accessible
      accessibilityRole="button"
      accessibilityLabel={`${market.name}, ${market.region}`}
    >
      <Card padded style={{ gap: theme.spacing.sm }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: theme.radius.md,
              backgroundColor: theme.colors.primary,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="storefront-outline" size={22} color={theme.colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <ThemedText variant="subtitle">{market.name}</ThemedText>
            <ThemedText variant="caption" color="muted">
              {market.region}
            </ThemedText>
          </View>
          <Pressable
            hitSlop={8}
            onPress={handleToggleFavorite}
            accessibilityRole="button"
            accessibilityLabel={isFavorite ? "Remove from favourites" : "Add to favourites"}
          >
            <Animated.View style={{ transform: [{ scale: heartScale }] }}>
              <Ionicons
                name={isFavorite ? "heart" : "heart-outline"}
                size={18}
                color={isFavorite ? theme.colors.danger : theme.colors.textMuted}
              />
            </Animated.View>
          </Pressable>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
        </View>

        {priceStats || popularCommodities.length > 0 ? (
          <View
            style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: theme.spacing.xs }}
          >
            {priceStats ? (
              <Badge label={PRICE_LEVEL_LABEL[priceStats.level]} tone={PRICE_LEVEL_TONE[priceStats.level]} />
            ) : null}
            {popularCommodities.map((name) => (
              <Badge key={name} label={name} tone="neutral" />
            ))}
          </View>
        ) : null}
      </Card>
    </Pressable>
  );
});
