import React from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Card, ThemedText } from "@/components/ui";
import { useTheme } from "@/theme";
import type { Market } from "@/types";

export type MarketCardProps = {
  market: Market;
  onPress?: () => void;
};

/** Compact horizontal-scroll variant of MarketRow, used on the Home screen. */
export const MarketCard = React.memo(function MarketCard({ market, onPress }: MarketCardProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessible
      accessibilityRole="button"
      accessibilityLabel={`${market.name}, ${market.region}`}
    >
      <Card style={{ width: 132, gap: theme.spacing.sm }}>
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
        <View>
          <ThemedText variant="body" weight="semibold" numberOfLines={1}>
            {market.name}
          </ThemedText>
          <ThemedText variant="label" color="muted" numberOfLines={1} style={{ textTransform: "capitalize" }}>
            {market.region.toLowerCase()}
          </ThemedText>
        </View>
      </Card>
    </Pressable>
  );
});
