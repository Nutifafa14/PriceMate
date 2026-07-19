import React from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/theme";

import { Button } from "./Button";
import { ThemedText } from "./ThemedText";

export type EmptyStateProps = {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({
  icon = "search-outline",
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  const theme = useTheme();

  return (
    <View
      style={{
        alignItems: "center",
        justifyContent: "center",
        gap: theme.spacing.sm,
        padding: theme.spacing.xl,
      }}
    >
      <Ionicons name={icon} size={40} color={theme.colors.textMuted} />
      <ThemedText variant="subtitle" style={{ textAlign: "center" }}>
        {title}
      </ThemedText>
      {description ? (
        <ThemedText variant="caption" color="muted" style={{ textAlign: "center" }}>
          {description}
        </ThemedText>
      ) : null}
      {onAction ? (
        <Button
          label={actionLabel ?? "Try again"}
          variant="outline"
          size="sm"
          fullWidth={false}
          onPress={onAction}
          style={{ marginTop: theme.spacing.xs }}
        />
      ) : null}
    </View>
  );
}
