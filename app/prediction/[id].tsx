import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Pressable, View } from "react-native";
import { Image } from "expo-image";

import {
  Badge,
  Card,
  EmptyState,
  ForecastRangeGauge,
  Screen,
  ScreenHeader,
  ThemedText,
  YearMonthWheelPicker,
} from "@/components/ui";
import { getSeasonality } from "@/data/seasonality";
import { useCommodity, useLatestPrices, useMarket, useNews, usePredictPrice } from "@/hooks";
import { ApiError } from "@/lib/api-client";
import { useTheme } from "@/theme";
import type { ForecastResult } from "@/types";
import { pickMostRecentWholesale } from "@/utils/prices";
import { classifyMonth, seasonalitySummary } from "@/utils/seasonality";

const CONFIDENCE_TONE: Record<ForecastResult["confidenceLabel"], "success" | "neutral" | "danger"> = {
  moderate: "success",
  low: "neutral",
  "very low": "danger",
};

const CONFIDENCE_COPY: Record<ForecastResult["confidenceLabel"], string> = {
  moderate: "Moderate confidence",
  low: "Low confidence",
  "very low": "Very low confidence",
};

function formatFreshness(iso: string | undefined): string | undefined {
  if (!iso) return undefined;
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

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

// The ML model's real training data ends here (ml/models/metadata.json
// date_range[1] — must stay in sync with forecast-pipeline.ts's
// BASELINE_TRAINING_END). Used only for a client-side "how far out is this"
// hint before a prediction comes back; the authoritative confidence/range
// widening happens server-side once the real forecast response arrives.
const TRAINING_END = { year: 2023, month: 7 };
const FAR_FUTURE_WARNING_MONTHS = 24;

function monthsBeyondTraining(year: number, month: number): number {
  return (year - TRAINING_END.year) * 12 + (month - TRAINING_END.month);
}

function nextMonth(from: Date): { year: number; month: number } {
  const month = from.getMonth() + 1; // 0-indexed -> 1-indexed "this month"
  return month === 12 ? { year: from.getFullYear() + 1, month: 1 } : { year: from.getFullYear(), month: month + 1 };
}

const now = new Date();
const CURRENT_YEAR = now.getFullYear();
const CURRENT_MONTH = now.getMonth() + 1;
const MAX_YEAR = CURRENT_YEAR + 5; // future dates are unbounded in principle (Goal 4), capped here since confidence past this is not meaningfully different from "very low" — see forecast-pipeline.ts's extrapolation widening.

export default function PredictionScreen() {
  const theme = useTheme();
  const { id, marketId: marketIdParam } = useLocalSearchParams<{ id: string; marketId?: string }>();
  const [target, setTarget] = useState(() => nextMonth(now));

  const commodityQuery = useCommodity(id);

  // Falls back to the commodity's default market if none was passed in the route (e.g. a direct deep link).
  const fallbackLatestQuery = useLatestPrices({ commodityId: id }, { enabled: !marketIdParam });
  const marketId = marketIdParam ?? pickMostRecentWholesale(fallbackLatestQuery.data ?? [])?.marketId;
  const marketQuery = useMarket(marketId);

  const predictMutation = usePredictPrice();

  useEffect(() => {
    if (!id || !marketId) return;
    predictMutation.mutate({ commodityId: id, marketId, month: target.month, year: target.year });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, marketId, target.month, target.year]);

  const commodity = commodityQuery.data;
  const seasonality = commodity ? getSeasonality(commodity.name) : undefined;
  const selectedSeason = classifyMonth(seasonality, target.month);
  const newsQuery = useNews(commodity?.name);
  const [whyExpanded, setWhyExpanded] = useState(false);

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
              <ThemedText variant="label" color="muted" style={{ textAlign: "center" }}>
                Forecast date
              </ThemedText>
              <YearMonthWheelPicker
                value={target}
                minYear={CURRENT_YEAR}
                minMonthForMinYear={CURRENT_MONTH}
                maxYear={MAX_YEAR}
                onChange={setTarget}
              />
              {selectedSeason !== "neutral" ? (
                <Badge
                  label={selectedSeason === "harvest" ? "Typical harvest season" : "Typical lean season"}
                  tone={selectedSeason === "harvest" ? "success" : "danger"}
                />
              ) : null}
              {monthsBeyondTraining(target.year, target.month) > FAR_FUTURE_WARNING_MONTHS ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.xs }}>
                  <Ionicons name="warning-outline" size={14} color={theme.colors.textMuted} />
                  <ThemedText variant="label" color="muted" style={{ flex: 1 }}>
                    {Math.round(monthsBeyondTraining(target.year, target.month) / 12)}+ years beyond the
                    model&apos;s training data — expect a wider range and lower confidence below.
                  </ThemedText>
                </View>
              ) : null}
            </View>

            {predictMutation.isPending ? (
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
                  predictMutation.mutate({
                    commodityId: id,
                    marketId,
                    month: target.month,
                    year: target.year,
                  })
                }
              />
            ) : predictMutation.data ? (
              <View style={{ gap: theme.spacing.md }}>
                <View style={{ gap: theme.spacing.sm, alignItems: "center" }}>
                  <ThemedText variant="caption" color="muted">
                    Forecast for {MONTH_NAMES[target.month - 1]} {target.year}
                  </ThemedText>
                  <ThemedText variant="display" weight="bold">
                    GHS {predictMutation.data.centralEstimate.toFixed(2)}
                  </ThemedText>
                  <Badge
                    label={CONFIDENCE_COPY[predictMutation.data.confidenceLabel]}
                    tone={CONFIDENCE_TONE[predictMutation.data.confidenceLabel]}
                  />
                </View>

                <ForecastRangeGauge
                  low={predictMutation.data.lowEstimate}
                  central={predictMutation.data.centralEstimate}
                  high={predictMutation.data.highEstimate}
                />

                <Pressable
                  onPress={() => setWhyExpanded((v) => !v)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: whyExpanded }}
                  accessibilityLabel="Why this forecast"
                  style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.xs }}
                >
                  <Ionicons
                    name={whyExpanded ? "chevron-down" : "chevron-forward"}
                    size={16}
                    color={theme.colors.accent}
                  />
                  <ThemedText variant="label" weight="semibold" color="accent">
                    Why this forecast
                  </ThemedText>
                </Pressable>

                {whyExpanded ? (
                  <View style={{ gap: theme.spacing.sm }}>
                    {predictMutation.data.why.map((line, i) => (
                      <View key={i} style={{ flexDirection: "row", gap: theme.spacing.xs }}>
                        <ThemedText variant="label" color="muted">
                          •
                        </ThemedText>
                        <ThemedText variant="label" color="muted" style={{ flex: 1 }}>
                          {line}
                        </ThemedText>
                      </View>
                    ))}
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.xs }}>
                      {formatFreshness(predictMutation.data.dataFreshness.fxAsOf) ? (
                        <Badge
                          label={`FX data as of ${formatFreshness(predictMutation.data.dataFreshness.fxAsOf)}`}
                          tone="neutral"
                        />
                      ) : null}
                      {formatFreshness(predictMutation.data.dataFreshness.benchmarkAsOf) ? (
                        <Badge
                          label={`Global price data as of ${formatFreshness(predictMutation.data.dataFreshness.benchmarkAsOf)}`}
                          tone="neutral"
                        />
                      ) : null}
                      {formatFreshness(predictMutation.data.dataFreshness.newsAsOf) ? (
                        <Badge
                          label={`News data as of ${formatFreshness(predictMutation.data.dataFreshness.newsAsOf)}`}
                          tone="neutral"
                        />
                      ) : null}
                      <Badge
                        label={`Model trained through ${predictMutation.data.dataFreshness.modelTrainedThrough}`}
                        tone="neutral"
                      />
                    </View>
                  </View>
                ) : null}

                <ThemedText variant="label" color="muted" style={{ textAlign: "center" }}>
                  Model: {predictMutation.data.modelName ?? "unknown"} · Wholesale price only
                </ThemedText>
                <ThemedText
                  variant="caption"
                  color="muted"
                  style={{ textAlign: "center", fontStyle: "italic" }}
                >
                  {predictMutation.data.disclaimer}
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
              No {commodity?.name ?? "commodity"}-specific Ghana news in the last 30 days (the free news
              API&apos;s real coverage window) — shown empty rather than padded with unrelated articles.
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
          Forecasts combine a wholesale-price model trained on 2015–2023 data with live exchange-rate,
          global-price, and news signals as of today — see &quot;Why this forecast&quot; above for the full,
          disclosed breakdown for your selected date.
        </ThemedText>
      </View>
    </Screen>
  );
}
