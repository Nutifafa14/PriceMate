import React from "react";
import { Text, type TextProps } from "react-native";

import { useTheme } from "@/theme";

type Variant = "display" | "title" | "subtitle" | "body" | "caption" | "label";
type Weight = "regular" | "medium" | "semibold" | "bold";
type ColorToken = "primary" | "muted" | "onPrimary" | "onAccent" | "accent" | "danger" | "success";

export type ThemedTextProps = TextProps & {
  variant?: Variant;
  weight?: Weight;
  color?: ColorToken;
};

const VARIANT_SIZE: Record<Variant, { size: keyof ReturnType<typeof useTheme>["fontSize"]; weight: Weight }> =
  {
    display: { size: "display", weight: "bold" },
    title: { size: "xxl", weight: "bold" },
    subtitle: { size: "lg", weight: "semibold" },
    body: { size: "md", weight: "regular" },
    caption: { size: "sm", weight: "regular" },
    label: { size: "xs", weight: "medium" },
  };

export function ThemedText({ variant = "body", weight, color = "primary", style, ...rest }: ThemedTextProps) {
  const theme = useTheme();
  const { size, weight: defaultWeight } = VARIANT_SIZE[variant];
  const resolvedWeight = weight ?? defaultWeight;

  const colorMap: Record<ColorToken, string> = {
    primary: theme.colors.text,
    muted: theme.colors.textMuted,
    onPrimary: theme.colors.textOnPrimary,
    onAccent: theme.colors.textOnAccent,
    accent: theme.colors.accent,
    danger: theme.colors.danger,
    success: theme.colors.success,
  };

  return (
    <Text
      style={[
        {
          color: colorMap[color],
          fontFamily: theme.fontFamily[resolvedWeight],
          fontSize: theme.fontSize[size],
          lineHeight: theme.lineHeight[size],
        },
        style,
      ]}
      {...rest}
    />
  );
}
