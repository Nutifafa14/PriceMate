import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";

import {
  Badge,
  Button,
  Card,
  EmptyState,
  Screen,
  SegmentedControl,
  TextField,
  ThemedText,
} from "@/components/ui";
import { useCommodities, useOptimizeBasket, useSaveBasket } from "@/hooks";
import { useAuthStore } from "@/store/auth-store";
import { useTheme } from "@/theme";
import type { BasketMarketPlan, BasketOptimizationResult } from "@/types";

type DraftItem = { commodityId: string; commodityName: string; quantity: number };
type PlanKey = "recommended" | "combination" | "singleMarket" | "perItem";

const PLAN_LABEL: Record<PlanKey, string> = {
  recommended: "Best",
  combination: "Combo",
  singleMarket: "1 market",
  perItem: "Per item",
};

function planFor(result: BasketOptimizationResult, key: PlanKey): BasketMarketPlan | undefined {
  if (key === "recommended") {
    if (result.recommendation.plan === "combination") return result.bestCombination;
    if (result.recommendation.plan === "singleMarket") return result.cheapestSingleMarket;
    if (result.recommendation.plan === "perItem") return result.cheapestPerItem;
    return undefined;
  }
  if (key === "combination") return result.bestCombination;
  if (key === "singleMarket") return result.cheapestSingleMarket;
  return result.cheapestPerItem;
}

export default function BasketScreen() {
  const theme = useTheme();
  const user = useAuthStore((state) => state.user);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<DraftItem[]>([]);
  const [basketName, setBasketName] = useState("");
  const [activeTab, setActiveTab] = useState<PlanKey>("recommended");

  const commoditiesQuery = useCommodities();
  const optimizeMutation = useOptimizeBasket();
  const saveMutation = useSaveBasket();

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const alreadyAdded = new Set(items.map((i) => i.commodityId));
    return (commoditiesQuery.data ?? [])
      .filter((c) => c.name.toLowerCase().includes(q) && !alreadyAdded.has(c.id))
      .slice(0, 6);
  }, [commoditiesQuery.data, query, items]);

  // Once a result comes back, each priced item carries the honest unit its
  // quantity was actually compared in ("kg" for weight-normalized
  // commodities, else the raw unit — see basket-optimizer.ts). Before that
  // first optimization, the unit isn't known yet, so the stepper just shows
  // a bare count.
  function unitLabelFor(commodityId: string): string | undefined {
    return optimizeMutation.data?.items.find((i) => i.commodityId === commodityId)?.unitLabel;
  }

  function addItem(commodityId: string, commodityName: string) {
    setItems((prev) => [...prev, { commodityId, commodityName, quantity: 1 }]);
    setQuery("");
    optimizeMutation.reset();
  }

  function updateQuantity(commodityId: string, delta: number) {
    setItems((prev) =>
      prev.map((i) => (i.commodityId === commodityId ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i)),
    );
    optimizeMutation.reset();
  }

  function removeItem(commodityId: string) {
    setItems((prev) => prev.filter((i) => i.commodityId !== commodityId));
    optimizeMutation.reset();
  }

  function handleOptimize() {
    setActiveTab("recommended");
    optimizeMutation.mutate(items.map((i) => ({ commodityId: i.commodityId, quantity: i.quantity })));
  }

  function handleSave() {
    if (!basketName.trim()) return;
    saveMutation.mutate(
      { name: basketName.trim(), items: items.map((i) => ({ commodityId: i.commodityId, quantity: i.quantity })) },
      { onSuccess: () => setBasketName("") },
    );
  }

  const result = optimizeMutation.data;
  const activePlan = result ? planFor(result, activeTab) : undefined;

  return (
    <Screen scroll edges={["top"]}>
      <View style={{ gap: theme.spacing.lg, paddingTop: theme.spacing.md, paddingBottom: theme.spacing.xxl }}>
        <View>
          <ThemedText variant="title">Basket Optimiser</ThemedText>
          <ThemedText variant="caption" color="muted">
            Add what you need to buy — we&apos;ll find the cheapest way to get it, real prices, real transport
            trade-offs.
          </ThemedText>
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <TextField
            placeholder="Search commodities to add…"
            value={query}
            onChangeText={setQuery}
            leftElement={<Ionicons name="search-outline" size={18} color={theme.colors.textMuted} />}
          />
          {suggestions.length > 0 ? (
            <Card style={{ gap: 2 }} padded={false}>
              {suggestions.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => addItem(c.id, c.name)}
                  accessibilityRole="button"
                  accessibilityLabel={`Add ${c.name} to basket`}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingVertical: theme.spacing.sm,
                    paddingHorizontal: theme.spacing.md,
                  }}
                >
                  <ThemedText variant="body">{c.name}</ThemedText>
                  <Ionicons name="add-circle-outline" size={20} color={theme.colors.accent} />
                </Pressable>
              ))}
            </Card>
          ) : null}
        </View>

        {items.length === 0 ? (
          <EmptyState
            icon="basket-outline"
            title="Your basket is empty"
            description="Search for a commodity above and add it to get started."
          />
        ) : (
          <View style={{ gap: theme.spacing.sm }}>
            {items.map((item) => {
              const unitLabel = unitLabelFor(item.commodityId);
              return (
                <Card key={item.commodityId} style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.sm }}>
                  <View style={{ flex: 1 }}>
                    <ThemedText variant="body" weight="semibold">
                      {item.commodityName}
                    </ThemedText>
                    {unitLabel ? (
                      <ThemedText variant="label" color="muted">
                        Priced per {unitLabel}
                      </ThemedText>
                    ) : null}
                  </View>
                  <Pressable
                    onPress={() => updateQuantity(item.commodityId, -1)}
                    accessibilityRole="button"
                    accessibilityLabel={`Decrease ${item.commodityName} quantity`}
                    style={{ padding: theme.spacing.xs }}
                  >
                    <Ionicons name="remove-circle-outline" size={22} color={theme.colors.textMuted} />
                  </Pressable>
                  <ThemedText variant="body" weight="semibold" style={{ minWidth: 44, textAlign: "center" }}>
                    {item.quantity}
                    {unitLabel ? ` ${unitLabel}` : ""}
                  </ThemedText>
                  <Pressable
                    onPress={() => updateQuantity(item.commodityId, 1)}
                    accessibilityRole="button"
                    accessibilityLabel={`Increase ${item.commodityName} quantity`}
                    style={{ padding: theme.spacing.xs }}
                  >
                    <Ionicons name="add-circle-outline" size={22} color={theme.colors.accent} />
                  </Pressable>
                  <Pressable
                    onPress={() => removeItem(item.commodityId)}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${item.commodityName} from basket`}
                    style={{ padding: theme.spacing.xs }}
                  >
                    <Ionicons name="trash-outline" size={20} color={theme.colors.danger} />
                  </Pressable>
                </Card>
              );
            })}

            <Button
              label={optimizeMutation.isPending ? "Calculating…" : "Find cheapest way to buy this"}
              onPress={handleOptimize}
              loading={optimizeMutation.isPending}
              disabled={items.length === 0}
            />
            {items.length > 0 && !result ? (
              <ThemedText variant="label" color="muted" style={{ textAlign: "center" }}>
                Quantities are treated as kilograms for most items, or as the market&apos;s own unit (e.g. tubers,
                bunches) for a few — the exact unit for each item shows up here once you calculate.
              </ThemedText>
            ) : null}
          </View>
        )}

        {optimizeMutation.isError ? (
          <EmptyState
            icon="alert-circle-outline"
            title="Couldn't calculate this basket"
            description="Check that the server is reachable and try again."
            onAction={handleOptimize}
          />
        ) : null}

        {result ? (
          <View style={{ gap: theme.spacing.md }}>
            <Card style={{ gap: theme.spacing.xs, backgroundColor: theme.colors.accentMuted }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.xs }}>
                <Ionicons name="bulb-outline" size={18} color={theme.colors.accent} />
                <ThemedText variant="subtitle">Recommendation</ThemedText>
              </View>
              <ThemedText variant="body">{result.recommendation.reasoning}</ThemedText>
            </Card>

            {result.unpriceableItems.length > 0 ? (
              <Card style={{ gap: theme.spacing.xs }}>
                <ThemedText variant="label" color="muted">
                  No recent Wholesale price found for: {result.unpriceableItems.map((i) => i.commodityName).join(", ")}
                </ThemedText>
              </Card>
            ) : null}

            {result.items.some((i) => i.excludedMarkets.length > 0) ? (
              <Card style={{ gap: theme.spacing.xs }}>
                <ThemedText variant="label" weight="semibold" color="muted">
                  Some markets couldn&apos;t be honestly compared
                </ThemedText>
                {result.items
                  .filter((i) => i.excludedMarkets.length > 0)
                  .map((i) => (
                    <View key={i.commodityId} style={{ gap: 2 }}>
                      {i.excludedMarkets.map((ex) => (
                        <ThemedText key={ex.marketId} variant="label" color="muted">
                          {i.commodityName} · {ex.marketName}: {ex.reason}
                        </ThemedText>
                      ))}
                    </View>
                  ))}
              </Card>
            ) : null}

            <SegmentedControl
              options={(["recommended", "combination", "singleMarket", "perItem"] as PlanKey[]).map((key) => ({
                value: key,
                label: PLAN_LABEL[key],
              }))}
              value={activeTab}
              onChange={setActiveTab}
            />

            {activePlan ? (
              <Card style={{ gap: theme.spacing.sm }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <ThemedText variant="subtitle">
                    {activePlan.marketNames.length === 1 ? activePlan.marketNames[0] : `${activePlan.marketNames.length} markets`}
                  </ThemedText>
                  <Badge label={`Net GHS ${activePlan.netCost.toFixed(2)}`} tone="accent" />
                </View>

                <View style={{ gap: theme.spacing.xs }}>
                  {activePlan.perItem.map((line) => {
                    const sourceItem = result.items.find((i) => i.commodityId === line.commodityId);
                    return (
                      <View
                        key={line.commodityId}
                        style={{ flexDirection: "row", justifyContent: "space-between" }}
                      >
                        <ThemedText variant="label" color="muted" style={{ flex: 1 }}>
                          {line.commodityName}
                          {sourceItem ? ` (${sourceItem.quantity} ${sourceItem.unitLabel})` : ""} · {line.marketName}
                        </ThemedText>
                        <ThemedText variant="label">GHS {line.lineCost.toFixed(2)}</ThemedText>
                      </View>
                    );
                  })}
                </View>

                <View style={{ borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: theme.spacing.sm, gap: 2 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <ThemedText variant="label" color="muted">
                      Item total
                    </ThemedText>
                    <ThemedText variant="label">GHS {activePlan.itemTotal.toFixed(2)}</ThemedText>
                  </View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <ThemedText variant="label" color="muted">
                      Estimated transport ({activePlan.marketIds.length} market{activePlan.marketIds.length === 1 ? "" : "s"})
                    </ThemedText>
                    <ThemedText variant="label">GHS {activePlan.transportCost.toFixed(2)}</ThemedText>
                  </View>
                </View>
                <ThemedText variant="label" color="muted" style={{ fontStyle: "italic" }}>
                  Transport is a disclosed flat estimate (GHS {result.transportCostPerExtraMarket} per market beyond
                  the first) — not a real GPS distance calculation.
                </ThemedText>
              </Card>
            ) : (
              <EmptyState
                icon="information-circle-outline"
                title="This plan isn't available"
                description="No market combination covers every item in this basket for this option."
              />
            )}

            {user ? (
              <Card style={{ gap: theme.spacing.sm }}>
                <ThemedText variant="subtitle">Save this list</ThemedText>
                <TextField placeholder="e.g. Weekly shop" value={basketName} onChangeText={setBasketName} />
                <Button
                  label={saveMutation.isSuccess ? "Saved!" : "Save"}
                  variant="outline"
                  onPress={handleSave}
                  loading={saveMutation.isPending}
                  disabled={!basketName.trim()}
                />
              </Card>
            ) : (
              <ThemedText variant="caption" color="muted" style={{ textAlign: "center" }}>
                Sign in to save this list for next time.
              </ThemedText>
            )}
          </View>
        ) : null}
      </View>
    </Screen>
  );
}