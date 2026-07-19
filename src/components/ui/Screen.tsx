import React, { useEffect, useState } from "react";
import { Animated, ScrollView, StyleSheet, type ViewProps } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

import { useTheme } from "@/theme";

export type ScreenProps = ViewProps & {
  scroll?: boolean;
  edges?: Edge[];
  padded?: boolean;
  /** Fade + slight rise on mount. On by default; turn off for screens that swap content in place (e.g. a live-updating chart) where re-triggering on every render would be distracting. */
  animated?: boolean;
};

export function Screen({
  scroll = false,
  edges = ["top", "bottom"],
  padded = true,
  animated = true,
  style,
  children,
  ...rest
}: ScreenProps) {
  const theme = useTheme();
  const [opacity] = useState(() => new Animated.Value(animated ? 0 : 1));
  const [translateY] = useState(() => new Animated.Value(animated ? 8 : 0));

  useEffect(() => {
    if (!animated) return;
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start();
    // Intentionally runs once per mount only — a fresh Screen instance per navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const content = (
    <Animated.View
      style={[
        padded && { paddingHorizontal: theme.spacing.lg },
        animated && { opacity, transform: [{ translateY }] },
        style,
      ]}
      {...rest}
    >
      {children}
    </Animated.View>
  );

  return (
    <SafeAreaView edges={edges} style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      {scroll ? (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1 },
});
