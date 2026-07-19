import React, { useEffect, useState } from "react";
import { Animated, View, type DimensionValue } from "react-native";

import { useTheme } from "@/theme";

export type SkeletonProps = {
  width?: DimensionValue;
  height?: number;
  radius?: number;
};

/** Pulsing placeholder block for loading states — no extra dependency, just RN's core Animated API. */
export function Skeleton({ width = "100%", height = 16, radius }: SkeletonProps) {
  const theme = useTheme();
  const [opacity] = useState(() => new Animated.Value(0.4));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={{
        width,
        height,
        borderRadius: radius ?? theme.radius.sm,
        backgroundColor: theme.colors.border,
        opacity,
      }}
    />
  );
}

/** Skeleton shaped like a CommodityCard grid item, for Home/Favourites while loading. */
export function CommodityCardSkeleton() {
  const theme = useTheme();
  return (
    <View
      style={{
        backgroundColor: theme.colors.card,
        borderRadius: theme.radius.lg,
        borderWidth: theme.isDark ? 1 : 0,
        borderColor: theme.colors.border,
        padding: theme.spacing.lg,
        gap: theme.spacing.sm,
      }}
    >
      <Skeleton width={44} height={44} radius={theme.radius.md} />
      <Skeleton width="70%" height={18} />
      <Skeleton width="50%" height={13} />
      <Skeleton width="60%" height={20} />
    </View>
  );
}

/** Skeleton shaped like a MarketRow, for the Markets list while loading. */
export function MarketRowSkeleton() {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: theme.spacing.md,
        backgroundColor: theme.colors.card,
        borderRadius: theme.radius.lg,
        borderWidth: theme.isDark ? 1 : 0,
        borderColor: theme.colors.border,
        padding: theme.spacing.lg,
      }}
    >
      <Skeleton width={48} height={48} radius={theme.radius.md} />
      <View style={{ flex: 1, gap: theme.spacing.xs }}>
        <Skeleton width="50%" height={16} />
        <Skeleton width="35%" height={13} />
      </View>
    </View>
  );
}
