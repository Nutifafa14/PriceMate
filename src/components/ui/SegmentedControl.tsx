import React from "react";
import { Pressable, View } from "react-native";

import { useTheme } from "@/theme";

import { ThemedText } from "./ThemedText";

export type SegmentedControlProps<T extends string> = {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
};

export function SegmentedControl<T extends string>({ options, value, onChange }: SegmentedControlProps<T>) {
  const theme = useTheme();

  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: theme.colors.background,
        borderRadius: theme.radius.pill,
        padding: theme.spacing.xs,
      }}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option.label}
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              paddingVertical: theme.spacing.xs,
              borderRadius: theme.radius.pill,
              backgroundColor: active ? theme.colors.card : "transparent",
              ...(active ? theme.shadow.soft : null),
            }}
          >
            <ThemedText variant="label" weight="semibold" color={active ? "primary" : "muted"}>
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}
