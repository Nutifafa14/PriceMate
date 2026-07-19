import React from "react";
import { View } from "react-native";

import { useTheme } from "@/theme";

import { ThemedText } from "./ThemedText";

type Tone = "neutral" | "success" | "danger" | "accent";

export type BadgeProps = {
  label: string;
  tone?: Tone;
};

export function Badge({ label, tone = "neutral" }: BadgeProps) {
  const theme = useTheme();

  const toneColors: Record<Tone, { bg: string; fg: "muted" | "success" | "danger" | "accent" }> = {
    neutral: { bg: theme.colors.border, fg: "muted" },
    success: { bg: theme.colors.successBg, fg: "success" },
    danger: { bg: theme.colors.dangerBg, fg: "danger" },
    accent: { bg: theme.colors.accentMuted, fg: "accent" },
  };
  const { bg, fg } = toneColors[tone];

  return (
    <View
      style={{
        backgroundColor: bg,
        borderRadius: theme.radius.pill,
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: theme.spacing.xs,
        alignSelf: "flex-start",
      }}
    >
      <ThemedText variant="label" color={fg}>
        {label}
      </ThemedText>
    </View>
  );
}
