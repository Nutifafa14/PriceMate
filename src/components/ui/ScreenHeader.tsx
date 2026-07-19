import React from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import { useTheme } from "@/theme";

import { ThemedText } from "./ThemedText";

export type ScreenHeaderProps = {
  title: string;
  onBack?: () => void;
  rightElement?: React.ReactNode;
};

/**
 * Custom themed header used on detail screens instead of expo-router's
 * native Stack header, so title typography/back-button styling match the
 * rest of the app (Poppins, theme tokens) rather than the OS default.
 */
export function ScreenHeader({ title, onBack, rightElement }: ScreenHeaderProps) {
  const theme = useTheme();

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: theme.spacing.md,
        paddingTop: theme.spacing.sm,
        paddingBottom: theme.spacing.md,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        hitSlop={8}
        onPress={onBack ?? (() => router.back())}
        style={{
          width: 40,
          height: 40,
          borderRadius: theme.radius.pill,
          backgroundColor: theme.colors.card,
          borderWidth: theme.isDark ? 1 : 0,
          borderColor: theme.colors.border,
          alignItems: "center",
          justifyContent: "center",
          ...theme.shadow.soft,
        }}
      >
        <Ionicons name="chevron-back" size={20} color={theme.colors.text} />
      </Pressable>
      <ThemedText variant="subtitle" weight="semibold" numberOfLines={1} style={{ flex: 1 }}>
        {title}
      </ThemedText>
      {rightElement}
    </View>
  );
}
