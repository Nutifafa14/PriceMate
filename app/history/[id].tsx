import { Stack, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import {
  Card,
  EmptyState,
  PriceChart,
  Screen,
  ScreenHeader,
  SegmentedControl,
  ThemedText,
} from "@/components/ui";
import { useCommodity, useLatestPrices, useMarket, usePrices } from "@/hooks";
import { useTheme } from "@/theme";
import { pickMostRecentWholesale } from "@/utils/prices";

const RANGE_OPTIONS = [
  { value: "3m", label: "3M", months: 3 },
  { value: "6m", label: "6M", months: 6 },
  { value: "1y", label: "1Y", months: 12 },
  { value: "all", label: "All", months: null },
] as const;

type RangeValue = (typeof RANGE_OPTIONS)[number]["value"];
const HISTORY_LIMIT = 200; // real max for any single (commodity, market) pair is 68

function subtractMonths(isoDate: string, months: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCMonth(date.getUTCMonth() - months);
  return date.toISOString().slice(0, 10);
}

export default function HistoryScreen() {
  const theme = useTheme();
  const { id, marketId: marketIdParam } = useLocalSearchParams<{ id: string; marketId?: string }>();
  const [range, setRange] = useState<RangeValue>("1y");

  const commodityQuery = useCommodity(id);
  // Falls back to the commodity's default market if none was passed in the route (e.g. a direct deep link).
  const fallbackLatestQuery = useLatestPrices({ commodityId: id }, { enabled: !marketIdParam });
  const marketId = marketIdParam ?? pickMostRecentWholesale(fallbackLatestQuery.data ?? [])?.marketId;

  const marketQuery = useMarket(marketId);
  const historyQuery = usePrices(
    { commodityId: id, marketId, priceType: "Wholesale", limit: HISTORY_LIMIT },
    { enabled: Boolean(marketId) },
  );

  const history = useMemo(() => [...(historyQuery.data ?? [])].reverse(), [historyQuery.data]);

  const filtered = useMemo(() => {
    const option = RANGE_OPTIONS.find((o) => o.value === range)!;
    if (option.months === null || history.length === 0) return history;
    const latestDate = history[history.length - 1].date;
    const cutoff = subtractMonths(latestDate, option.months);
    return history.filter((p) => p.date >= cutoff);
  }, [history, range]);

  const isLoading =
    commodityQuery.isLoading || (!marketIdParam && fallbackLatestQuery.isLoading) || historyQuery.isLoading;

  if (isLoading) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenHeader title="History" />
        <ActivityIndicator color={theme.colors.accent} style={{ marginTop: theme.spacing.xl }} />
      </Screen>
    );
  }

  if (!commodityQuery.data || !marketId) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenHeader title="History" />
        <EmptyState
          icon="alert-circle-outline"
          title="No wholesale history available"
          description={
            commodityQuery.data
              ? `${commodityQuery.data.name} has no Wholesale price records to chart.`
              : "Commodity not found."
          }
        />
      </Screen>
    );
  }

  const commodity = commodityQuery.data;
  const prices = filtered.map((p) => p.price);
  const min = prices.length ? Math.min(...prices) : 0;
  const max = prices.length ? Math.max(...prices) : 0;
  const avg = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;

  return (
    <Screen scroll>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title={`${commodity.name} History`} />
      <View style={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <ThemedText variant="caption" color="muted">
          {marketQuery.data?.name ?? "…"} · {history[history.length - 1]?.unit ?? ""} · Wholesale
        </ThemedText>

        <Card style={{ gap: theme.spacing.md }}>
          <SegmentedControl options={[...RANGE_OPTIONS]} value={range} onChange={setRange} />
          <PriceChart data={filtered} height={200} />
        </Card>

        <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
          <StatCard label="Min" value={min} />
          <StatCard label="Average" value={avg} />
          <StatCard label="Max" value={max} />
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <ThemedText variant="subtitle">Recorded prices ({filtered.length})</ThemedText>
          <Card padded={false} style={{ overflow: "hidden" }}>
            {[...filtered].reverse().map((point, index, arr) => (
              <View
                key={point.id}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingHorizontal: theme.spacing.md,
                  paddingVertical: theme.spacing.sm,
                  borderBottomWidth: index === arr.length - 1 ? 0 : 1,
                  borderBottomColor: theme.colors.border,
                }}
              >
                <ThemedText variant="body" color="muted">
                  {point.date}
                </ThemedText>
                <ThemedText variant="body" weight="semibold">
                  GHS {point.price.toFixed(2)}
                </ThemedText>
              </View>
            ))}
          </Card>
        </View>
      </View>
    </Screen>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  const theme = useTheme();
  return (
    <Card style={{ flex: 1, gap: theme.spacing.xs, alignItems: "center" }}>
      <ThemedText variant="label" color="muted">
        {label}
      </ThemedText>
      <ThemedText variant="body" weight="bold">
        {value.toFixed(2)}
      </ThemedText>
    </Card>
  );
}
