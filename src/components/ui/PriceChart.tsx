import React from "react";
import { View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";

import { useTheme } from "@/theme";

import { ThemedText } from "./ThemedText";

export type PriceChartPoint = { date: string; price: number };

export type PriceChartProps = {
  data: PriceChartPoint[];
  height?: number;
  color?: string;
};

const H_PADDING = 4;
const V_PADDING = 20;

/**
 * Minimal SVG line/area chart with no external charting dependency beyond
 * react-native-svg (Expo Go compatible). Non-interactive by design — this
 * renders a trend, not a data-exploration tool. The SVG itself is invisible
 * to screen readers, so the outer View carries one accessibilityLabel
 * summarizing what the chart shows instead.
 */
export function PriceChart({ data, height = 160, color }: PriceChartProps) {
  const theme = useTheme();
  const lineColor = color ?? theme.colors.accent;

  if (data.length < 2) {
    return (
      <View style={{ height, alignItems: "center", justifyContent: "center" }}>
        <ThemedText variant="caption" color="muted">
          Not enough data points to chart yet
        </ThemedText>
      </View>
    );
  }

  const prices = data.map((d) => d.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const summary = `Price trend chart, ${data.length} points from ${data[0].date} to ${data[data.length - 1].date}, ranging from GHS ${min.toFixed(2)} to GHS ${max.toFixed(2)}, most recent GHS ${prices[prices.length - 1].toFixed(2)}.`;

  return (
    <View accessible accessibilityLabel={summary} style={{ gap: theme.spacing.xs }}>
      <View style={{ height }}>
        <ChartSvg data={data} height={height} min={min} max={max} color={lineColor} />
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <ThemedText variant="label" color="muted">
          {data[0].date}
        </ThemedText>
        <ThemedText variant="label" color="muted">
          {data[data.length - 1].date}
        </ThemedText>
      </View>
    </View>
  );
}

function ChartSvg({
  data,
  height,
  min,
  max,
  color,
}: {
  data: PriceChartPoint[];
  height: number;
  min: number;
  max: number;
  color: string;
}) {
  const [width, setWidth] = React.useState(0);

  return (
    <View style={{ flex: 1 }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 ? (
        <ChartBody data={data} width={width} height={height} min={min} max={max} color={color} />
      ) : null}
    </View>
  );
}

function ChartBody({
  data,
  width,
  height,
  min,
  max,
  color,
}: {
  data: PriceChartPoint[];
  width: number;
  height: number;
  min: number;
  max: number;
  color: string;
}) {
  const theme = useTheme();
  const range = max - min || 1;

  const innerWidth = width - H_PADDING * 2;
  const innerHeight = height - V_PADDING * 2;

  const points = data.map((d, i) => {
    const x = H_PADDING + (i / (data.length - 1)) * innerWidth;
    const y = V_PADDING + innerHeight - ((d.price - min) / range) * innerHeight;
    return { x, y };
  });

  const linePath = points.reduce((acc, p, i) => acc + (i === 0 ? `M ${p.x} ${p.y}` : ` L ${p.x} ${p.y}`), "");
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;
  const last = points[points.length - 1];
  const maxPoint = points.reduce((a, b) => (b.y < a.y ? b : a));
  const minPoint = points.reduce((a, b) => (b.y > a.y ? b : a));

  return (
    <View style={{ flex: 1 }}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="priceArea" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity={0.25} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Path d={areaPath} fill="url(#priceArea)" />
        <Path
          d={linePath}
          stroke={color}
          strokeWidth={2.5}
          fill="none"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <Circle cx={last.x} cy={last.y} r={4.5} fill={color} />
      </Svg>
      <ThemedText
        variant="label"
        color="muted"
        style={{
          position: "absolute",
          left: Math.min(Math.max(maxPoint.x - 16, 0), width - 40),
          top: Math.max(maxPoint.y - 16, 0),
        }}
      >
        {max.toFixed(0)}
      </ThemedText>
      <ThemedText
        variant="label"
        color="muted"
        style={{
          position: "absolute",
          left: Math.min(Math.max(minPoint.x - 16, 0), width - 40),
          top: Math.min(minPoint.y + 4, height - theme.fontSize.xs - 2),
        }}
      >
        {min.toFixed(0)}
      </ThemedText>
    </View>
  );
}
