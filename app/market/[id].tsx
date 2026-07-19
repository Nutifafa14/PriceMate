import { Ionicons } from "@expo/vector-icons";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { CommodityCard } from "@/components/CommodityCard";
import { CommodityListItem } from "@/components/CommodityListItem";
import {
  Badge,
  Card,
  EmptyState,
  Screen,
  ScreenHeader,
  SegmentedControl,
  ThemedText,
  ViewToggle,
} from "@/components/ui";
import { useCommodities, useCommunityPrices, useLatestPrices, useMarket } from "@/hooks";
import { useViewPreferenceStore } from "@/store/view-preference-store";
import { useTheme } from "@/theme";
import { groupLatestCommunityByCommodity, groupLatestWholesaleByCommodity } from "@/utils/prices";
import type { Commodity, CommunityPricePoint, PricePoint } from "@/types";

type Entry = { commodity: Commodity; price: PricePoint };
type CommunityEntry = { commodity: Commodity; report: CommunityPricePoint };
type MarketTab = "wholesale" | "community";

export default function MarketDetailScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const viewMode = useViewPreferenceStore((state) => state.commodityViewMode);
  const setViewMode = useViewPreferenceStore((state) => state.setCommodityViewMode);
  const [tab, setTab] = useState<MarketTab>("wholesale");

  const marketQuery = useMarket(id);
  const pricesQuery = useLatestPrices({ marketId: id });
  const communityPricesQuery = useCommunityPrices({ marketId: id, limit: 500 });
  const commoditiesQuery = useCommodities();

  const commodityById = useMemo(
    () => new Map((commoditiesQuery.data ?? []).map((c) => [c.id, c])),
    [commoditiesQuery.data],
  );

  const entries = useMemo(() => {
    const byCommodity = groupLatestWholesaleByCommodity(pricesQuery.data ?? []);
    const result: Entry[] = [];
    for (const [commodityId, price] of byCommodity) {
      const commodity = commodityById.get(commodityId);
      if (commodity) result.push({ commodity, price });
    }
    return result;
  }, [pricesQuery.data, commodityById]);

  const communityEntries = useMemo(() => {
    const byCommodity = groupLatestCommunityByCommodity(communityPricesQuery.data ?? []);
    const result: CommunityEntry[] = [];
    for (const [commodityId, report] of byCommodity) {
      const commodity = commodityById.get(commodityId);
      if (commodity) result.push({ commodity, report });
    }
    return result.sort((a, b) => a.commodity.name.localeCompare(b.commodity.name));
  }, [communityPricesQuery.data, commodityById]);

  if (marketQuery.isLoading) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenHeader title="Market" />
        <ActivityIndicator color={theme.colors.accent} style={{ marginTop: theme.spacing.xl }} />
      </Screen>
    );
  }

  if (marketQuery.isError || !marketQuery.data) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenHeader title="Market" />
        <EmptyState
          icon="alert-circle-outline"
          title="Couldn't load this market"
          onAction={() => marketQuery.refetch()}
        />
      </Screen>
    );
  }

  const market = marketQuery.data;

  return (
    <Screen scroll>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title={market.name} />
      <View style={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Card style={{ gap: theme.spacing.sm }}>
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
            <View>
              <ThemedText variant="title">{market.name}</ThemedText>
              <ThemedText variant="body" color="muted" style={{ textTransform: "capitalize" }}>
                {market.region.toLowerCase()}
              </ThemedText>
            </View>
          </View>
          {market.latitude != null && market.longitude != null ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.xs }}>
              <Ionicons name="location-outline" size={14} color={theme.colors.textMuted} />
              <ThemedText variant="caption" color="muted">
                {market.latitude.toFixed(2)}, {market.longitude.toFixed(2)}
              </ThemedText>
            </View>
          ) : null}
        </Card>

        <SegmentedControl<MarketTab>
          value={tab}
          onChange={setTab}
          options={[
            { value: "wholesale", label: "Wholesale" },
            { value: "community", label: `Community Reports (${communityEntries.length})` },
          ]}
        />

        {tab === "wholesale" ? (
          <View style={{ gap: theme.spacing.sm }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <ThemedText variant="subtitle">Prices at this market ({entries.length})</ThemedText>
              {entries.length > 0 ? <ViewToggle value={viewMode} onChange={setViewMode} /> : null}
            </View>
            {pricesQuery.isLoading || commoditiesQuery.isLoading ? (
              <ActivityIndicator color={theme.colors.accent} />
            ) : entries.length === 0 ? (
              <EmptyState
                icon="pricetags-outline"
                title="No wholesale prices recorded here"
                description="This market may only carry commodities tracked at Retail prices, or — if it's a recently added named market — may only have Community Reports data. Check the other tab."
              />
            ) : viewMode === "list" ? (
              <View style={{ gap: theme.spacing.sm }}>
                {entries.map(({ commodity, price }) => (
                  <CommodityListItem
                    key={commodity.id}
                    commodity={commodity}
                    latestPrice={price}
                    marketName={market.name}
                    onPress={() => router.push(`/commodity/${commodity.id}`)}
                  />
                ))}
              </View>
            ) : (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.md }}>
                {entries.map(({ commodity, price }) => (
                  <View key={commodity.id} style={{ width: "47%" }}>
                    <CommodityCard
                      commodity={commodity}
                      latestPrice={price}
                      marketName={market.name}
                      onPress={() => router.push(`/commodity/${commodity.id}`)}
                    />
                  </View>
                ))}
              </View>
            )}
          </View>
        ) : (
          <View style={{ gap: theme.spacing.sm }}>
            <Card style={{ backgroundColor: theme.colors.background, gap: theme.spacing.xs }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.xs }}>
                <Ionicons name="information-circle-outline" size={16} color={theme.colors.textMuted} />
                <ThemedText variant="label" weight="semibold" color="muted">
                  As reported by MoFA SRID
                </ThemedText>
              </View>
              <ThemedText variant="caption" color="muted">
                Real government price reports from 2025. The source doesn&apos;t specify a unit, so these
                figures aren&apos;t directly comparable to the Wholesale tab&apos;s per-unit trend and
                aren&apos;t used in price predictions — see them as independent, as-reported data points.
              </ThemedText>
            </Card>

            {communityPricesQuery.isLoading || commoditiesQuery.isLoading ? (
              <ActivityIndicator color={theme.colors.accent} />
            ) : communityEntries.length === 0 ? (
              <EmptyState
                icon="chatbox-ellipses-outline"
                title="No community reports for this market"
                description="MoFA SRID hasn't published a price report for this market's tracked commodities."
              />
            ) : (
              <View style={{ gap: theme.spacing.sm }}>
                {communityEntries.map(({ commodity, report }) => (
                  <Card key={commodity.id} padded style={{ gap: theme.spacing.xs }}>
                    <View
                      style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
                    >
                      <ThemedText variant="body" weight="semibold">
                        {commodity.name}
                      </ThemedText>
                      <Badge label={report.priceType} tone="neutral" />
                    </View>
                    <View
                      style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
                    >
                      <ThemedText variant="subtitle" weight="bold">
                        {report.currency} {report.price.toFixed(2)}
                      </ThemedText>
                      <ThemedText variant="label" color="muted">
                        {report.date}
                      </ThemedText>
                    </View>
                  </Card>
                ))}
              </View>
            )}
          </View>
        )}
      </View>
    </Screen>
  );
}
