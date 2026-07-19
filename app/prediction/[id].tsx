import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Linking, Pressable, View } from "react-native";
import { Image } from "expo-image";

import { Badge, Card, EmptyState, Screen, ScreenHeader, ThemedText } from "@/components/ui";
import { getSeasonality } from "@/data/seasonality";
import { useCommodity, useLatestPrices, useMarket, useNews, usePredictPrice } from "@/hooks";
import { ApiError } from "@/lib/api-client";
import { useTheme } from "@/theme";
import { predictionConfidence } from "@/utils/prediction-confidence";
import { pickMostRecentWholesale } from "@/utils/prices";
import { classifyMonth, seasonalitySummary } from "@/utils/seasonality";

// 1-12 months ahead, anchored to the dataset's own last recorded date
// (2023-07), not today's real date — predicting relative to today would
// extrapolate the model 3+ years beyond anything ml/reports/MODEL_EVALUATION.md
// actually evaluated its accuracy on. See addMonths below.
const HORIZONS = Array.from({ length: 12 }, (_, i) => i + 1);

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const MONTH_ABBR = MONTH_NAMES.map((m) => m.slice(0, 3));

function addMonths(isoDate: string, months: number): { month: number; year: number } {
  const [y, m] = isoDate.split("-").map(Number);
  const total = m - 1 + months;
  return { year: y + Math.floor(total / 12), month: (total % 12) + 1 };
}

export default function PredictionScreen() {
  const theme = useTheme();
  const { id, marketId: marketIdParam } = useLocalSearchParams<{ id: string; marketId?: string }>();
  const [horizon, setHorizon] = useState(1);

  const commodityQuery = useCommodity(id);

  // Falls back to the commodity's default market if none was passed in the route (e.g. a direct deep link).
  const fallbackLatestQuery = useLatestPrices({ commodityId: id }, { enabled: !marketIdParam });
  const marketId = marketIdParam ?? pickMostRecentWholesale(fallbackLatestQuery.data ?? [])?.marketId;
  const marketQuery = useMarket(marketId);

  // Always resolved the same way once marketId is known, regardless of where it came from — this
  // commodity+market pair's latest recorded date anchors "next month", since the dataset ends in 2023,
  // not today (predicting relative to today's real date would extrapolate years beyond training data).
  const anchorQuery = useLatestPrices({ commodityId: id, marketId }, { enabled: Boolean(marketId) });
  const anchorDate = pickMostRecentWholesale(anchorQuery.data ?? [])?.date;
  const target = anchorDate ? addMonths(anchorDate, horizon) : undefined;

  const predictMutation = usePredictPrice();

  useEffect(() => {
    if (!id || !marketId || !target) return;
    predictMutation.mutate({ commodityId: id, marketId, month: target.month, year: target.year });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, marketId, target?.month, target?.year]);

  const commodity = commodityQuery.data;
  const confidence = commodity ? predictionConfidence(commodity.category) : undefined;
  const seasonality = commodity ? getSeasonality(commodity.name) : undefined;
  const newsQuery = useNews();

  return (
    <Screen scroll>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title="Price Prediction" />
      <View style={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Card style={{ alignItems: "center", gap: theme.spacing.md }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: theme.radius.pill,
              backgroundColor: theme.colors.accentMuted,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="sparkles-outline" size={32} color={theme.colors.primary} />
          </View>
          <ThemedText variant="subtitle" style={{ textAlign: "center" }}>
            {commodity ? commodity.name : "Loading…"}
          </ThemedText>
          <ThemedText variant="caption" color="muted" style={{ textAlign: "center" }}>
            {marketQuery.data?.name ?? "…"}
          </ThemedText>
        </Card>

        {!marketId ? (
          <EmptyState
            icon="pricetags-outline"
            title="No wholesale data to forecast from"
            description="This commodity has no wholesale price history, so a forecast isn't available."
          />
        ) : (
          <Card style={{ gap: theme.spacing.md }}>
            <View style={{ gap: theme.spacing.xs }}>
              <ThemedText variant="label" color="muted">
                Months ahead of the dataset&apos;s last recorded price
              </ThemedText>
              <FlatList
                horizontal
                data={HORIZONS}
                keyExtractor={(h) => String(h)}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: theme.spacing.sm }}
                renderItem={({ item: h }) => {
                  const active = h === horizon;
                  const targetMonth = anchorDate ? addMonths(anchorDate, h).month : undefined;
                  const label = targetMonth ? MONTH_ABBR[targetMonth - 1] : String(h);
                  const season = targetMonth ? classifyMonth(seasonality, targetMonth) : "neutral";
                  const seasonBg =
                    season === "harvest"
                      ? theme.colors.successBg
                      : season === "lean"
                        ? theme.colors.dangerBg
                        : theme.colors.card;
                  return (
                    <Pressable
                      onPress={() => setHorizon(h)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={`${h} month${h === 1 ? "" : "s"} ahead${
                        season === "harvest"
                          ? ", typical harvest season"
                          : season === "lean"
                            ? ", typical lean season"
                            : ""
                      }`}
                    >
                      <View
                        style={{
                          minWidth: 52,
                          alignItems: "center",
                          paddingHorizontal: theme.spacing.sm,
                          paddingVertical: theme.spacing.sm,
                          borderRadius: theme.radius.pill,
                          backgroundColor: active ? theme.colors.accent : seasonBg,
                          borderWidth: active ? 0 : 1,
                          borderColor: theme.colors.border,
                        }}
                      >
                        <ThemedText variant="label" weight="semibold" color={active ? "onAccent" : "primary"}>
                          +{h}
                        </ThemedText>
                        <ThemedText variant="label" color={active ? "onAccent" : "muted"}>
                          {label}
                        </ThemedText>
                      </View>
                    </Pressable>
                  );
                }}
              />
              {seasonality ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.xs }}>
                    <View
                      style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.success }}
                    />
                    <ThemedText variant="label" color="muted">
                      Harvest
                    </ThemedText>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.xs }}>
                    <View
                      style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.danger }}
                    />
                    <ThemedText variant="label" color="muted">
                      Lean season
                    </ThemedText>
                  </View>
                </View>
              ) : null}
              {horizon > 6 ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.xs }}>
                  <Ionicons name="warning-outline" size={14} color={theme.colors.textMuted} />
                  <ThemedText variant="label" color="muted">
                    Further out than this model is typically tested on — treat as a rougher estimate.
                  </ThemedText>
                </View>
              ) : null}
            </View>

            {predictMutation.isPending || !target ? (
              <ActivityIndicator color={theme.colors.accent} style={{ paddingVertical: theme.spacing.lg }} />
            ) : predictMutation.isError ? (
              <EmptyState
                icon="alert-circle-outline"
                title="Couldn't get a prediction"
                description={
                  predictMutation.error instanceof ApiError
                    ? predictMutation.error.message
                    : "Check that the prediction service is running."
                }
                onAction={() =>
                  marketId &&
                  target &&
                  predictMutation.mutate({
                    commodityId: id,
                    marketId,
                    month: target.month,
                    year: target.year,
                  })
                }
              />
            ) : predictMutation.data ? (
              <View style={{ gap: theme.spacing.sm, alignItems: "center" }}>
                <ThemedText variant="caption" color="muted">
                  Forecast for {MONTH_NAMES[target.month - 1]} {target.year}
                </ThemedText>
                <ThemedText variant="display" weight="bold">
                  GHS {predictMutation.data.predictedPrice.toFixed(2)}
                </ThemedText>
                {confidence ? <Badge label={confidence.label} tone={confidence.tone} /> : null}
                <ThemedText
                  variant="label"
                  color="muted"
                  style={{ textAlign: "center", marginTop: theme.spacing.xs }}
                >
                  Model: {predictMutation.data.modelName ?? "unknown"} · Wholesale price only
                </ThemedText>
              </View>
            ) : null}
          </Card>
        )}

        {seasonality ? (
          <Card style={{ gap: theme.spacing.sm }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.xs }}>
              <Ionicons name="calendar-outline" size={16} color={theme.colors.accent} />
              <ThemedText variant="subtitle">Seasonality</ThemedText>
            </View>
            <ThemedText variant="body" color="muted">
              {seasonalitySummary(seasonality)}
            </ThemedText>
            <ThemedText variant="label" color="muted" style={{ fontStyle: "italic" }}>
              Source: {seasonality.source}
            </ThemedText>
          </Card>
        ) : (
          <Card style={{ gap: theme.spacing.xs }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.xs }}>
              <Ionicons name="calendar-outline" size={16} color={theme.colors.textMuted} />
              <ThemedText variant="subtitle" color="muted">
                Seasonality
              </ThemedText>
            </View>
            <ThemedText variant="body" color="muted">
              A verified seasonal calendar isn&apos;t available yet for {commodity?.name ?? "this commodity"}.
            </ThemedText>
          </Card>
        )}

        <View style={{ gap: theme.spacing.sm }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.xs }}>
            <Ionicons name="newspaper-outline" size={16} color={theme.colors.accent} />
            <ThemedText variant="subtitle">Related news</ThemedText>
          </View>
          {newsQuery.isLoading ? (
            <ActivityIndicator color={theme.colors.accent} />
          ) : (newsQuery.data ?? []).length === 0 ? (
            <ThemedText variant="caption" color="muted">
              No Ghana food/agriculture news available right now.
            </ThemedText>
          ) : (
            <View style={{ gap: theme.spacing.sm }}>
              {(newsQuery.data ?? []).slice(0, 5).map((article) => (
                <Pressable
                  key={article.url}
                  onPress={() => Linking.openURL(article.url)}
                  accessibilityRole="link"
                  accessibilityLabel={`${article.title}, from ${article.sourceName}`}
                >
                  <Card padded style={{ flexDirection: "row", gap: theme.spacing.sm, alignItems: "center" }}>
                    {article.image ? (
                      <Image
                        source={{ uri: article.image }}
                        style={{ width: 56, height: 56, borderRadius: theme.radius.sm }}
                        contentFit="cover"
                      />
                    ) : (
                      <View
                        style={{
                          width: 56,
                          height: 56,
                          borderRadius: theme.radius.sm,
                          backgroundColor: theme.colors.background,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Ionicons name="newspaper-outline" size={22} color={theme.colors.textMuted} />
                      </View>
                    )}
                    <View style={{ flex: 1, gap: 2 }}>
                      <ThemedText variant="label" weight="semibold" numberOfLines={2}>
                        {article.title}
                      </ThemedText>
                      <ThemedText variant="label" color="muted" numberOfLines={1}>
                        {article.sourceName} · {new Date(article.publishedAt).toLocaleDateString()}
                      </ThemedText>
                    </View>
                  </Card>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        <ThemedText variant="caption" color="muted" style={{ textAlign: "center" }}>
          Forecasts are anchored to the dataset&apos;s latest recorded price (2015–2023), not today&apos;s
          date, and predict wholesale price from commodity, market, month and year only — see the model
          evaluation report for the full accuracy breakdown.
        </ThemedText>
      </View>
    </Screen>
  );
}
