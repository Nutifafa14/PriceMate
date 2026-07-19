import React from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/theme";
import type { CommodityViewMode } from "@/store/view-preference-store";

export type ViewToggleProps = {
  value: CommodityViewMode;
  onChange: (mode: CommodityViewMode) => void;
};

const OPTIONS: { mode: CommodityViewMode; icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { mode: "grid", icon: "grid-outline", label: "Grid view" },
  { mode: "list", icon: "list-outline", label: "List view" },
];

/** Compact icon-only view-mode switcher — grid vs. list for commodity listings. */
export function ViewToggle({ value, onChange }: ViewToggleProps) {
  const theme = useTheme();

  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: theme.colors.background,
        borderRadius: theme.radius.pill,
        padding: theme.spacing.xs,
        gap: theme.spacing.xs,
      }}
    >
      {OPTIONS.map((option) => {
        const active = option.mode === value;
        return (
          <Pressable
            key={option.mode}
            onPress={() => onChange(option.mode)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option.label}
            hitSlop={6}
            style={{
              width: 32,
              height: 32,
              borderRadius: theme.radius.pill,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: active ? theme.colors.card : "transparent",
              ...(active ? theme.shadow.soft : null),
            }}
          >
            <Ionicons
              name={option.icon}
              size={16}
              color={active ? theme.colors.accent : theme.colors.textMuted}
            />
          </Pressable>
        );
      })}
    </View>
  );
}
