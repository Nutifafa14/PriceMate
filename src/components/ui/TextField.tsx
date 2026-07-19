import React, { useState } from "react";
import { StyleSheet, TextInput, View, type TextInputProps } from "react-native";

import { useTheme } from "@/theme";

import { ThemedText } from "./ThemedText";

export type TextFieldProps = TextInputProps & {
  label?: string;
  error?: string;
  leftElement?: React.ReactNode;
  rightElement?: React.ReactNode;
};

export function TextField({
  label,
  error,
  leftElement,
  rightElement,
  style,
  onFocus,
  onBlur,
  ...rest
}: TextFieldProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  const borderColor = error ? theme.colors.danger : focused ? theme.colors.accent : theme.colors.border;

  return (
    <View style={{ gap: theme.spacing.xs }}>
      {label ? (
        <ThemedText variant="label" color="muted" style={{ marginLeft: theme.spacing.xs }}>
          {label}
        </ThemedText>
      ) : null}
      <View
        style={[
          styles.inputRow,
          {
            borderColor,
            borderRadius: theme.radius.md,
            backgroundColor: theme.colors.card,
            paddingHorizontal: theme.spacing.md,
            gap: theme.spacing.sm,
          },
        ]}
      >
        {leftElement}
        <TextInput
          placeholderTextColor={theme.colors.textMuted}
          style={[
            styles.input,
            {
              color: theme.colors.text,
              fontFamily: theme.fontFamily.regular,
              fontSize: theme.fontSize.md,
            },
            style,
          ]}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />
        {rightElement}
      </View>
      {error ? (
        <ThemedText variant="caption" color="danger" style={{ marginLeft: theme.spacing.xs }}>
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}

// Layout-only rules with no theme dependency stay in a static StyleSheet;
// anything theme-derived (spacing, color, radius) is applied inline above
// so it can react to the current theme.
const styles = StyleSheet.create({
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
  },
  input: { flex: 1, height: 52 },
});
