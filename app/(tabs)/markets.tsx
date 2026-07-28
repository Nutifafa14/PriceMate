import { router } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { MarketRow } from "@/components/MarketRow";
import { EmptyState, MarketRowSkeleton, Screen, TextField, ThemedText } from "@/components/ui";
import { API_UNREACHABLE_HINT } from "@/constants/config";
import { useMarkets } from "@/hooks";
import { useTheme } from "@/theme";
import type { Market } from "@/types";

const EMPTY_MARKETS: Market[] = [];

export default function MarketsScreen() {
  const theme = useTheme();
  const [query, setQuery] = useState("");
  const [activeRegion, setActiveRegion] = useState<string | null>(null);

  const marketsQuery = useMarkets();
  const markets = marketsQuery.data ?? EMPTY_MARKETS;

  const regions = useMemo(() => Array.from(new Set(markets.map((m) => m.region))).sort(), [markets]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return markets.filter((m) => {
      const matchesQuery = q ? m.name.toLowerCase().includes(q) || m.region.toLowerCase().includes(q) : true;
      const matchesRegion = activeRegion ? m.region === activeRegion : true;
      return matchesQuery && matchesRegion;
    });
  }, [markets, query, activeRegion]);

  return (
    <Screen scroll edges={["top"]}>
      <View style={{ paddingTop: theme.spacing.md, gap: theme.spacing.md, paddingBottom: theme.spacing.xxl }}>
        <ThemedText variant="title">Markets</ThemedText>
        <TextField
          placeholder="Search markets or regions"
          value={query}
          onChangeText={setQuery}
          leftElement={<Ionicons name="search" size={18} color={theme.colors.textMuted} />}
        />

        {marketsQuery.isLoading ? (
          <View style={{ gap: theme.spacing.sm }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <MarketRowSkeleton key={i} />
            ))}
          </View>
        ) : marketsQuery.isError ? (
          <EmptyState
            icon="cloud-offline-outline"
            title="Couldn't load markets"
            description={API_UNREACHABLE_HINT}
            onAction={() => marketsQuery.refetch()}
          />
        ) : (
          <>
            <FlatList
              horizontal
              data={regions}
              keyExtractor={(item) => item}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: theme.spacing.sm }}
              renderItem={({ item }) => {
                const active = activeRegion === item;
                return (
                  <Pressable onPress={() => setActiveRegion(active ? null : item)}>
                    <View
                      style={{
                        paddingHorizontal: theme.spacing.md,
                        paddingVertical: theme.spacing.sm,
                        borderRadius: theme.radius.pill,
                        backgroundColor: active ? theme.colors.accent : theme.colors.card,
                        borderWidth: active ? 0 : 1,
                        borderColor: theme.colors.border,
                      }}
                    >
                      <ThemedText
                        variant="caption"
                        weight="medium"
                        color={active ? "onAccent" : "primary"}
                        style={{ textTransform: "capitalize" }}
                      >
                        {item.toLowerCase()}
                      </ThemedText>
                    </View>
                  </Pressable>
                );
              }}
            />

            <ThemedText variant="caption" color="muted">
              {results.length} market{results.length === 1 ? "" : "s"}
            </ThemedText>

            {results.length === 0 ? (
              <EmptyState icon="storefront-outline" title="No markets match your search" />
            ) : (
              <View style={{ gap: theme.spacing.sm }}>
                {results.map((item) => (
                  <MarketRow key={item.id} market={item} onPress={() => router.push(`/market/${item.id}`)} />
                ))}
              </View>
            )}
          </>
        )}
      </View>
    </Screen>
  );
}
