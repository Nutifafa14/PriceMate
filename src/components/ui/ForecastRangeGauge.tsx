import React from "react";
import { View } from "react-native";

import { useTheme } from "@/theme";

import { ThemedText } from "./ThemedText";

export type ForecastRangeGaugeProps = {
  low: number;
  central: number;
  high: number;
};

/**
 * A horizontal uncertainty band, not a bare number: the filled segment
 * spans [low, high] against a fixed 0..high*1.1 domain, so a wide (highly
 * uncertain) forecast visibly draws a wider band than a narrow one — the
 * width itself is information, not just decoration. Central estimate always
 * lands exactly in the middle of the filled segment by construction (the
 * pipeline's range is a symmetric ± percentage), so this deliberately
 * doesn't try to imply skew that isn't real.
 */
export function ForecastRangeGauge({ low, central, high }: ForecastRangeGaugeProps) {
  const theme = useTheme();
  const domainMax = high * 1.1 || 1;
  const lowPct = (low / domainMax) * 100;
  const highPct = (high / domainMax) * 100;
  const centralPct = (central / domainMax) * 100;

  return (
    <View style={{ gap: theme.spacing.xs }}>
      <View
        style={{
          height: 10,
          borderRadius: theme.radius.pill,
          backgroundColor: theme.colors.background,
          overflow: "hidden",
        }}
        accessible
        accessibilityLabel={`Forecast range: GHS ${low.toFixed(2)} to GHS ${high.toFixed(2)}, central estimate GHS ${central.toFixed(2)}`}
      >
        <View
          style={{
            position: "absolute",
            left: `${lowPct}%`,
            width: `${Math.max(highPct - lowPct, 2)}%`,
            height: "100%",
            backgroundColor: theme.colors.accentMuted,
          }}
        />
        <View
          style={{
            position: "absolute",
            left: `${centralPct}%`,
            width: 3,
            height: "100%",
            backgroundColor: theme.colors.accent,
          }}
        />
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <ThemedText variant="label" color="muted">
          GHS {low.toFixed(2)}
        </ThemedText>
        <ThemedText variant="label" color="muted">
          GHS {high.toFixed(2)}
        </ThemedText>
      </View>
    </View>
  );
}
