import React, { useState } from "react";
import { Animated, Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";

import { Badge, Card, ThemedText } from "@/components/ui";
import { useFavoritesStore } from "@/store/favorites-store";
import { useTheme } from "@/theme";
import { categoryIcon } from "@/utils/category-icon";
import { commodityPhoto } from "@/utils/commodity-photo";
import type { Commodity, PricePoint } from "@/types";

export type CommodityCardProps = {
  commodity: Commodity;
  /** Most recent Wholesale price for this commodity, if any — see src/utils/prices.ts. Absent for commodities with no Wholesale data (e.g. Cowpeas). */
  latestPrice?: PricePoint;
  marketName?: string;
  onPress?: () => void;
};

export const CommodityCard = React.memo(function CommodityCard({
  commodity,
  latestPrice,
  marketName,
  onPress,
}: CommodityCardProps) {
  const theme = useTheme();
  const isFavorite = useFavoritesStore((state) => state.isFavorite(commodity.id));
  const toggleFavorite = useFavoritesStore((state) => state.toggleFavorite);
  const [heartScale] = useState(() => new Animated.Value(1));
  const [photoFailed, setPhotoFailed] = useState(false);
  const photo = commodityPhoto(commodity.name);
  const showPhoto = photo && !photoFailed;

  const handleToggleFavorite = () => {
    toggleFavorite(commodity.id);
    Animated.sequence([
      Animated.spring(heartScale, { toValue: 1.3, useNativeDriver: true, speed: 50, bounciness: 12 }),
      Animated.spring(heartScale, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 12 }),
    ]).start();
  };

  const accessibilityLabel = latestPrice
    ? `${commodity.name}, GHS ${latestPrice.price.toFixed(2)} ${latestPrice.priceType.toLowerCase()} at ${marketName ?? "unknown market"}`
    : `${commodity.name}, no wholesale price data`;

  return (
    <Pressable
      onPress={onPress}
      style={{ flex: 1 }}
      accessible
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Card padded style={{ gap: theme.spacing.sm }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: theme.radius.md,
              backgroundColor: theme.colors.background,
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            {showPhoto ? (
              <Image
                source={photo}
                style={{ width: 44, height: 44 }}
                contentFit="cover"
                onError={() => setPhotoFailed(true)}
              />
            ) : (
              <Ionicons name={categoryIcon(commodity.category)} size={22} color={theme.colors.accent} />
            )}
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
                size={20}
                color={isFavorite ? theme.colors.danger : theme.colors.textMuted}
              />
            </Animated.View>
          </Pressable>
        </View>

        <ThemedText variant="subtitle" numberOfLines={1}>
          {commodity.name}
        </ThemedText>
        <ThemedText variant="caption" color="muted" numberOfLines={1}>
          {latestPrice ? `${marketName ?? "Unknown market"} · ${latestPrice.unit}` : "No wholesale data"}
        </ThemedText>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: theme.spacing.xs,
          }}
        >
          <ThemedText variant="subtitle" weight="bold" numberOfLines={1} style={{ flexShrink: 1 }}>
            {latestPrice ? `GHS ${latestPrice.price.toFixed(2)}` : "—"}
          </ThemedText>
          {latestPrice ? (
            <View style={{ flexShrink: 0 }}>
              <Badge label={latestPrice.priceType} tone="neutral" />
            </View>
          ) : null}
        </View>
      </Card>
    </Pressable>
  );
});
