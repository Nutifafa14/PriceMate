import React from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Card, ThemedText } from "@/components/ui";
import { useTheme } from "@/theme";
import type { Market } from "@/types";

export type MarketRowProps = {
  market: Market;
  onPress?: () => void;
};

export const MarketRow = React.memo(function MarketRow({ market, onPress }: MarketRowProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessible
      accessibilityRole="button"
      accessibilityLabel={`${market.name}, ${market.region}`}
    >
      <Card padded style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
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
        <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
      </Card>
    </Pressable>
  );
});
