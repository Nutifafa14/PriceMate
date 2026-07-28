import React, { useMemo, useState } from "react";
import { Animated, Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Card, ThemedText } from "@/components/ui";
import { useLatestPrices } from "@/hooks";
import { useFavoritesStore } from "@/store/favorites-store";
import { useTheme } from "@/theme";
import { computeMarketPriceStats } from "@/utils/market-stats";
import type { Market } from "@/types";

export type MarketCardProps = {
  market: Market;
  onPress?: () => void;
};

const PRICE_LEVEL_DOT_COLOR: Record<"low" | "average" | "high", "success" | "textMuted" | "danger"> = {
  low: "success",
  average: "textMuted",
  high: "danger",
};
const PRICE_LEVEL_A11Y: Record<"low" | "average" | "high", string> = {
  low: "low prices vs. national average",
  average: "average prices vs. national average",
  high: "high prices vs. national average",
};

/** Compact horizontal-scroll variant of MarketRow, used on the Home screen. */
export const MarketCard = React.memo(function MarketCard({ market, onPress }: MarketCardProps) {
  const theme = useTheme();
  const isFavorite = useFavoritesStore((state) => state.isFavoriteMarket(market.id));
  const toggleFavoriteMarket = useFavoritesStore((state) => state.toggleFavoriteMarket);
  const [heartScale] = useState(() => new Animated.Value(1));

  // React Query dedupes this across every MarketCard instance on screen.
  const latestPricesQuery = useLatestPrices();
  const priceStats = useMemo(
    () => computeMarketPriceStats(latestPricesQuery.data ?? [], market.id),
    [latestPricesQuery.data, market.id],
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
      accessibilityLabel={`${market.name}, ${market.region}${
        priceStats ? `, ${PRICE_LEVEL_A11Y[priceStats.level]}` : ""
      }`}
    >
      <Card style={{ width: 132, gap: theme.spacing.sm }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: theme.radius.md,
              backgroundColor: theme.colors.primary,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="storefront-outline" size={18} color={theme.colors.accent} />
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
                size={16}
                color={isFavorite ? theme.colors.danger : theme.colors.textMuted}
              />
            </Animated.View>
          </Pressable>
        </View>
        <View>
          <ThemedText variant="body" weight="semibold" numberOfLines={1}>
            {market.name}
          </ThemedText>
          <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.xs }}>
            {priceStats ? (
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: theme.colors[PRICE_LEVEL_DOT_COLOR[priceStats.level]],
                  flexShrink: 0,
                }}
              />
            ) : null}
            <ThemedText
              variant="label"
              color="muted"
              numberOfLines={1}
              style={{ textTransform: "capitalize", flexShrink: 1 }}
            >
              {market.region.toLowerCase()}
            </ThemedText>
          </View>
        </View>
      </Card>
    </Pressable>
  );
});
