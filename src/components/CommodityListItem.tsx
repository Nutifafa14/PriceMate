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

export type CommodityListItemProps = {
  commodity: Commodity;
  latestPrice?: PricePoint;
  marketName?: string;
  onPress?: () => void;
};

/** Dense, text-forward row variant of CommodityCard — same data, laid out for scanning many items at once. */
export const CommodityListItem = React.memo(function CommodityListItem({
  commodity,
  latestPrice,
  marketName,
  onPress,
}: CommodityListItemProps) {
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
      accessible
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Card padded style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: theme.radius.md,
            backgroundColor: theme.colors.background,
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            overflow: "hidden",
          }}
        >
          {showPhoto ? (
            <Image
              source={photo}
              style={{ width: 40, height: 40 }}
              contentFit="cover"
              onError={() => setPhotoFailed(true)}
            />
          ) : (
            <Ionicons name={categoryIcon(commodity.category)} size={20} color={theme.colors.accent} />
          )}
        </View>

        <View style={{ flex: 1, gap: 2 }}>
          <ThemedText variant="body" weight="semibold" numberOfLines={1}>
            {commodity.name}
          </ThemedText>
          <ThemedText variant="label" color="muted" numberOfLines={1}>
            {latestPrice ? `${marketName ?? "Unknown market"} · ${latestPrice.unit}` : "No wholesale data"}
          </ThemedText>
        </View>

        <View style={{ alignItems: "flex-end", gap: theme.spacing.xs, flexShrink: 0 }}>
          <ThemedText variant="body" weight="bold" numberOfLines={1}>
            {latestPrice ? `GHS ${latestPrice.price.toFixed(2)}` : "—"}
          </ThemedText>
          {latestPrice ? <Badge label={latestPrice.priceType} tone="neutral" /> : null}
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
      </Card>
    </Pressable>
  );
});
